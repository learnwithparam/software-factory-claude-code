// bun run factory <issue> [--dry-run] [--json]
//
// The factory runner: one issue from world/backlog/ in, a branch, a gate record and a result.json
// out. Each stage is one `claude -p` call in a fresh copy of the app, with a permission mode, its
// own allowed tools, a turn cap and a budget cap. See CLAUDE.md in this folder for the contract.
// This file imports nothing from outside this folder, so the folder runs wherever it is copied.
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const FACTORY = import.meta.dir;
const FOLDER = dirname(FACTORY);
const MAX_BUILD_ROUNDS = 2;
const GATE_COMMAND = "bun run gate";

// ---------- how each stage runs ----------

type Role = "fast" | "smart" | "judge";
const ALIAS: Record<Role, string> = { fast: "haiku", smart: "sonnet", judge: "sonnet" };

// Flags every stage passes. stream-json needs --verbose in print mode, and its last line is the
// result with total_cost_usd. dontAsk denies whatever --allowedTools does not cover.
// --setting-sources project,local loads the copy's own hooks and not ~/.claude.
// Never --bare: it skips the hooks, and the hooks are the gates.
const HEADLESS = [
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-hook-events",
  "--permission-mode",
  "dontAsk",
  "--setting-sources",
  "project,local",
  "--no-session-persistence",
];

type StageName = "triage" | "spec" | "build" | "review";
type Stage = {
  name: StageName;
  role: Role;
  tools: string;
  maxTurns: number;
  budget: number;
  schema?: object;
};

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    type: { enum: ["bug", "feature", "docs", "deps"] },
    risk: { enum: ["low", "medium", "high"] },
    files: { type: "array", items: { type: "string" } },
    decision: { enum: ["proceed", "refuse", "plan_only"] },
    reason: { type: "string" },
  },
  required: ["type", "risk", "files", "decision", "reason"],
};

const FINDING_SCHEMA = {
  type: "object",
  properties: {
    file: { type: "string" },
    line: { type: "integer" },
    evidence: { type: "string" },
  },
  required: ["file", "line", "evidence"],
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    verdict: { enum: ["pass", "block"] },
    findings: { type: "array", items: FINDING_SCHEMA },
  },
  required: ["verdict", "findings"],
};

const READ_TOOLS = "Read,Grep,Glob";
const WORK_TOOLS = `${READ_TOOLS},Edit,Write,Bash(bun test *),Bash(bun run gate)`;

const STAGES: Record<StageName, Stage> = {
  triage: {
    name: "triage",
    role: "fast",
    tools: READ_TOOLS,
    maxTurns: 12,
    budget: 0.5,
    schema: TRIAGE_SCHEMA,
  },
  spec: { name: "spec", role: "smart", tools: WORK_TOOLS, maxTurns: 30, budget: 2 },
  build: { name: "build", role: "smart", tools: WORK_TOOLS, maxTurns: 40, budget: 3 },
  review: {
    name: "review",
    role: "judge",
    tools: `${READ_TOOLS},Bash(git diff *)`,
    maxTurns: 20,
    budget: 1.5,
    schema: REVIEW_SCHEMA,
  },
};

// ---------- the result.json contract (the shape of checks/lib/result.ts) ----------

type State = "draft_pr" | "refused" | "stopped_at_plan" | "stopped_budget" | "gate_failed";
type Finding = { file: string; line: number; evidence: string };
type Review = { verdict: "pass" | "block"; findings: Finding[] };
type Blocked = { stage: string; tool: string; file: string; reason: string };
// biome-ignore-start lint/style/useNamingConvention: result.json uses snake_case keys.
type GateRecord = { command: string; exit_code: number; tree: string; rounds: number };
type ClaudeRun = { stage: string; transcript: string; turns: number; cost_usd: number };
// biome-ignore-end lint/style/useNamingConvention: the snake_case types end here.

type Issue = { number: number; title: string; body: string };
type Options = { issue: number; dryRun: boolean; json: boolean };

// Everything one run collects on its way to result.json.
type Run = Options & {
  root: string;
  runDir: string;
  repo: string;
  details: Issue;
  cap: number;
  dryGateFails: boolean;
  cost: number;
  budgetHit: boolean;
  roles: Record<string, Role>;
  claudeRuns: ClaudeRun[];
  blocked: Blocked[];
  gate: GateRecord | null;
  gateFailures: string;
  review: Review | null;
};

// ---------- small helpers ----------

// Progress always goes to stderr, so --json leaves stdout to the result alone.
function say(text: string): void {
  console.error(`factory: ${text}`);
}

function parseOptions(args: string[]): Options {
  const issueArgument = args.find((argument) => /^\d+$/.test(argument));
  const issue = Number(issueArgument);
  if (!issueArgument || issue < 1) {
    throw new Error("usage: bun run factory <issue> [--dry-run] [--json]");
  }
  return { issue, dryRun: args.includes("--dry-run"), json: args.includes("--json") };
}

// The repo root is the first folder above this one that holds world/backlog/.
function findRoot(start: string): string {
  let folder = dirname(start);
  while (!existsSync(join(folder, "world", "backlog"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error(`no folder above ${start} holds world/backlog/`);
    folder = parent;
  }
  return folder;
}

type Ran = { code: number; output: string };

function runCommand(command: string[], cwd: string): Ran {
  const finished = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const output = finished.stdout.toString() + finished.stderr.toString();
  return { code: finished.exitCode ?? 1, output };
}

// Every commit the factory makes has the same author and is never signed.
function git(repo: string, ...gitArgs: string[]): Ran {
  const identity = ["-c", "user.name=Northside factory", "-c", "user.email=factory@localhost"];
  const unsigned = ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"];
  const ran = runCommand(["git", ...identity, ...unsigned, ...gitArgs], repo);
  if (ran.code !== 0) throw new Error(`git ${gitArgs.join(" ")} failed: ${ran.output}`);
  return ran;
}

function snapshot(repo: string, label: string): void {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "--allow-empty", "-m", `factory: ${label}`);
}

// ---------- the issue and the fresh copy ----------

const FRONTMATTER_AND_BODY = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function readIssue(root: string, issue: number): Issue {
  const backlog = join(root, "world", "backlog");
  const file = readdirSync(backlog).find((name) => name.startsWith(`${issue}-`));
  if (!file?.endsWith(".md")) throw new Error(`there is no issue ${issue} in world/backlog`);
  const parts = readFileSync(join(backlog, file), "utf8").match(FRONTMATTER_AND_BODY);
  if (!parts) throw new Error(`${file}: an issue file starts with a --- frontmatter block`);
  const fields = Bun.YAML.parse(parts[1]) as { title?: string };
  return { number: issue, title: String(fields.title ?? ""), body: parts[2].trim() };
}

// world/app without node_modules, then factory/app, then world/gate.ts as .factory/gate.ts.
function freshCopy(root: string, repo: string, issue: number): void {
  const app = join(root, "world", "app");
  const skipModules = (source: string) => !relative(app, source).includes("node_modules");
  cpSync(app, repo, { recursive: true, filter: skipModules });
  cpSync(join(FACTORY, "app"), repo, { recursive: true });
  mkdirSync(join(repo, ".factory"), { recursive: true });
  copyFileSync(join(root, "world", "gate.ts"), join(repo, ".factory", "gate.ts"));
  git(repo, "init", "-q");
  snapshot(repo, "base");
  git(repo, "tag", "factory-base");
  git(repo, "switch", "-q", "-c", `factory/issue-${issue}`);
}

function startRun(options: Options): Run {
  const root = findRoot(FOLDER);
  const runs = resolve(process.env.FACTORY_RUNS ?? join(FOLDER, "runs"));
  const runDir = join(runs, String(options.issue));
  const repo = join(runDir, "repo");
  const details = readIssue(root, options.issue);
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(join(runDir, "transcripts"), { recursive: true });
  writeFileSync(join(runDir, "commands.txt"), "");
  freshCopy(root, repo, options.issue);
  const cap = Number(process.env.FACTORY_CAP_USD ?? 10);
  const dryGateFails = options.dryRun && process.env.FACTORY_DRY_GATE === "fail";
  const empty = { cost: 0, budgetHit: false, roles: {}, claudeRuns: [], blocked: [] };
  const nothingYet = { gate: null, gateFailures: "", review: null };
  return { ...options, root, runDir, repo, details, cap, dryGateFails, ...empty, ...nothingYet };
}

// ---------- one claude -p call ----------

function fillPrompt(stage: Stage, details: Issue, feedback: string): string {
  const template = readFileSync(join(FACTORY, "stages", `${stage.name}.md`), "utf8");
  const values: Record<string, string> = {
    number: String(details.number),
    title: details.title,
    body: details.body,
    feedback,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_slot, name) => values[name] ?? "");
}

function claudeArgv(stage: Stage, prompt: string): string[] {
  const schema = stage.schema ? ["--json-schema", JSON.stringify(stage.schema)] : [];
  const caps: string[] = [];
  const tools = ["--allowedTools", stage.tools];
  const model = ["--model", ALIAS[stage.role]];
  return ["claude", "-p", prompt, ...model, ...HEADLESS, ...tools, ...caps, ...schema];
}

function shellQuote(part: string): string {
  if (/^[\w@%+=:,./-]+$/.test(part)) return part;
  return `'${part.replaceAll("'", "'\\''")}'`;
}

// One line per call, with the prompt replaced by its stage file name.
function logCommand(run: Run, stage: Stage, argv: string[]): void {
  const shown = argv.map((part, index) => (index === 2 ? `factory/stages/${stage.name}.md` : part));
  const line = `FACTORY_STAGE=${stage.name} ${shown.map(shellQuote).join(" ")}`;
  appendFileSync(join(run.runDir, "commands.txt"), `${line}\n`);
}

// biome-ignore-start lint/style/useNamingConvention: stream-json uses snake_case keys.
type Block = { type?: string; is_error?: boolean; content?: string | { text?: string }[] };
type StreamEvent = {
  type?: string;
  subtype?: string;
  message?: { content?: Block[] };
  total_cost_usd?: number;
  num_turns?: number;
  structured_output?: Record<string, unknown> | null;
};
// biome-ignore-end lint/style/useNamingConvention: the stream-json types end here.

type Summary = {
  cost: number;
  turns: number;
  subtype: string;
  structured: StreamEvent["structured_output"];
};

function parseLine(line: string): StreamEvent | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function summarize(events: StreamEvent[]): Summary {
  const last = events.findLast((event) => event.type === "result");
  return {
    cost: last?.total_cost_usd ?? 0,
    turns: last?.num_turns ?? 0,
    subtype: last?.subtype ?? "no_result",
    structured: last?.structured_output ?? null,
  };
}

function blockText(block: Block): string {
  if (typeof block.content === "string") return block.content;
  return (block.content ?? []).map((part) => part.text ?? "").join(" ");
}

// Tool calls a hook blocked: the lock-tests hook answers with "Blocked: <file> ...".
function blockedByHooks(stage: string, events: StreamEvent[]): Blocked[] {
  const blocks = events.flatMap((event) => (event.type === "user" ? event.message?.content : []));
  const errors = blocks.filter((block) => block?.type === "tool_result" && block.is_error);
  const texts = errors.map((block) => blockText(block as Block));
  const blockedTexts = texts.filter((text) => text.includes("Blocked:"));
  return blockedTexts.map((text) => {
    const reason = text.slice(text.indexOf("Blocked:")).trim();
    const file = (reason.match(/^Blocked: (\S+)/)?.[1] ?? "").replace(/^.*\/repo\//, "");
    return { stage, tool: "Edit", file, reason };
  });
}

// Start claude in the copy with the stage name the hooks read, and return what it printed.
async function spawnClaude(run: Run, stage: Stage, argv: string[]): Promise<string> {
  const env: Record<string, string | undefined> = { ...process.env };
  env.FACTORY_STAGE = stage.name;
  env.FACTORY_HOOK_LOG = join(run.runDir, "hooks.jsonl");
  const child = Bun.spawn(argv, {
    cwd: run.repo,
    env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const printed = await new Response(child.stdout).text();
  await child.exited;
  return printed;
}

// Keep the transcript, its cost and turns, and any tool call a hook blocked.
function recordClaudeRun(run: Run, stage: Stage, label: string, printed: string): Summary {
  const transcript = join("transcripts", `${label}.jsonl`);
  writeFileSync(join(run.runDir, transcript), printed);
  const events = printed
    .split("\n")
    .map(parseLine)
    .filter((event) => event !== null);
  const summary = summarize(events);
  run.blocked.push(...blockedByHooks(stage.name, events));
  const costUsd = summary.cost;
  // biome-ignore lint/style/useNamingConvention: result.json uses snake_case keys.
  run.claudeRuns.push({ stage: stage.name, transcript, turns: summary.turns, cost_usd: costUsd });
  run.cost += costUsd;
  if (summary.subtype === "error_max_budget_usd" || run.cost > run.cap) run.budgetHit = true;
  return summary;
}

// Run one stage. A dry run logs the command and records the role, but starts no claude.
async function runClaude(
  run: Run,
  stage: Stage,
  label: string,
  feedback = "",
): Promise<Summary | null> {
  const argv = claudeArgv(stage, fillPrompt(stage, run.details, feedback));
  logCommand(run, stage, argv);
  run.roles[stage.name] = stage.role;
  if (run.dryRun) {
    say(`${label}: dry run, no claude call (${ALIAS[stage.role]})`);
    return null;
  }
  say(`${label}: claude -p with ${ALIAS[stage.role]}, up to $${stage.budget}`);
  const printed = await spawnClaude(run, stage, argv);
  const summary = recordClaudeRun(run, stage, label, printed);
  say(`${label}: ${summary.subtype}, ${summary.turns} turns, $${summary.cost.toFixed(2)}`);
  return summary;
}

// ---------- the gate ----------

type GateRun = { code: number; tree: string; output: string };

// The real gate, in the copy. FACTORY_DRY_GATE=fail makes a dry run treat it as failed.
function runGate(run: Run): GateRun {
  const ran = runCommand(GATE_COMMAND.split(" "), run.repo);
  const recordFile = join(run.repo, ".factory", "gate.json");
  let tree = "";
  if (existsSync(recordFile)) tree = String(JSON.parse(readFileSync(recordFile, "utf8")).tree);
  const code = run.dryGateFails ? 1 : ran.code;
  return { code, tree, output: ran.output.trim() };
}

function feedbackFor(run: Run): string {
  if (!run.gateFailures) return "";
  const heading = "The gate still fails after your last round:";
  return `\n${heading}\n${run.gateFailures}\nFix the code under src/.`;
}

// ---------- the stages ----------

type Decision = "proceed" | "refuse" | "plan_only" | null;

// A dry run takes triage answers from factory/backlog.json, from "Write the work order".
function dryDecision(issue: number): Decision {
  const backlog = JSON.parse(readFileSync(join(FACTORY, "backlog.json"), "utf8"));
  const entries = backlog as { issue: number; decision: string }[];
  const entry = entries.find((candidate) => candidate.issue === issue);
  if (entry?.decision === "ready") return "proceed";
  if (entry?.decision === "refuse") return "refuse";
  if (entry?.decision === "split") return "plan_only";
  return null;
}

async function triage(run: Run): Promise<Decision> {
  const summary = await runClaude(run, STAGES.triage, "triage");
  if (run.dryRun) return dryDecision(run.issue);
  const decision = summary?.structured?.decision;
  if (decision === "proceed" || decision === "refuse" || decision === "plan_only") return decision;
  return null;
}

async function spec(run: Run): Promise<void> {
  await runClaude(run, STAGES.spec, "spec");
  snapshot(run.repo, "spec");
  git(run.repo, "tag", "factory-spec");
}

// At most MAX_BUILD_ROUNDS rounds. The loop stops on a green gate, on the budget, or on the bound.
async function buildLoop(run: Run): Promise<"green" | "red" | "budget"> {
  for (let round = 1; round <= MAX_BUILD_ROUNDS; round++) {
    const label = round === 1 ? "build" : `build-${round}`;
    await runClaude(run, STAGES.build, label, feedbackFor(run));
    snapshot(run.repo, label);
    const gate = runGate(run);
    // biome-ignore lint/style/useNamingConvention: result.json uses snake_case keys.
    run.gate = { command: GATE_COMMAND, exit_code: gate.code, tree: gate.tree, rounds: round };
    run.gateFailures = gate.output.split("\n").slice(-13).join("\n");
    const verdict = gate.code === 0 ? "pass" : "fail";
    say(`${label}: gate ${verdict} (round ${round} of ${MAX_BUILD_ROUNDS})`);
    if (gate.code === 0) return "green";
    if (run.budgetHit) return "budget";
  }
  return "red";
}

function toReview(answer: Record<string, unknown> | null | undefined): Review | null {
  if (answer?.verdict !== "pass" && answer?.verdict !== "block") return null;
  const findings = Array.isArray(answer.findings) ? (answer.findings as Finding[]) : [];
  return { verdict: answer.verdict, findings };
}

async function reviewStage(run: Run): Promise<State> {
  const summary = await runClaude(run, STAGES.review, "review");
  if (run.dryRun) return "draft_pr";
  run.review = toReview(summary?.structured);
  say(`review: ${run.review?.verdict ?? "no verdict"}`);
  return run.review?.verdict === "pass" ? "draft_pr" : "gate_failed";
}

async function runStages(run: Run): Promise<State> {
  const decision = await triage(run);
  if (run.budgetHit) return "stopped_budget";
  if (decision === "refuse") return "refused";
  if (decision !== "proceed") return "stopped_at_plan";
  await spec(run);
  if (run.budgetHit) return "stopped_budget";
  const built = await buildLoop(run);
  if (built === "budget") return "stopped_budget";
  if (built === "red") return "gate_failed";
  return reviewStage(run);
}

// ---------- result.json ----------

// Test files the builder changed after the spec stage wrote them. The tests are locked in build.
function testsEdited(repo: string): string[] {
  const hasSpec = runCommand(["git", "rev-parse", "-q", "--verify", "factory-spec"], repo);
  if (hasSpec.code !== 0) return [];
  const diff = git(repo, "diff", "--name-only", "factory-spec", "HEAD", "--", "tests");
  return diff.output.split("\n").filter(Boolean);
}

// biome-ignore-start lint/style/useNamingConvention: result.json uses snake_case keys.
function toResult(run: Run, state: State) {
  return {
    issue: run.issue,
    state,
    branch: `factory/issue-${run.issue}`,
    worktree: relative(FOLDER, run.repo),
    pr_url: null,
    gate: run.gate,
    review: run.dryRun ? null : run.review,
    tests_edited: testsEdited(run.repo),
    blocked_by_hooks: run.blocked,
    roles_by_stage: run.roles,
    cost_usd: run.dryRun ? 0 : Number(run.cost.toFixed(6)),
    replayed: false,
    claude_runs: run.dryRun ? [] : run.claudeRuns,
  };
}
// biome-ignore-end lint/style/useNamingConvention: the result ends here.

async function main(): Promise<void> {
  const run = startRun(parseOptions(process.argv.slice(2)));
  const mode = run.dryRun ? "dry run" : `live, cap $${run.cap}`;
  say(`issue ${run.issue}: ${run.details.title} (${mode})`);
  const state = await runStages(run);
  const result = toResult(run, state);
  const json = JSON.stringify(result, null, 2);
  writeFileSync(join(run.runDir, "result.json"), `${json}\n`);
  say(`issue ${run.issue}: ${state}, ${relative(process.cwd(), run.runDir)}/result.json`);
  if (run.json) console.log(json);
}

try {
  await main();
} catch (error) {
  say(`error: ${(error as Error).message}`);
  process.exit(1);
}
