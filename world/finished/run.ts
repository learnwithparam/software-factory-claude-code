// bun run finished [issue] [--replay] [--run <name>] [--record <name>] [--out <folder>]
//
// The finished factory: one issue in, a branch whose tests pass, a review and a draft PR body out.
// Each stage is one real Claude Code run, `claude -p`, in a fresh copy of the lending app that
// holds the factory's own CLAUDE.md, .claude/settings.json and hooks (world/finished/factory/).
//
// With a signed-in `claude` on your machine it runs live. With no claude, in CI, or with --replay,
// it replays a recorded run from world/recordings/: the stream-json transcripts a real run printed
// and the changes it made. A replay applies those changes to a fresh copy, runs the gate for real,
// and runs the factory's hooks again on the exact events Claude Code sent them, so every claim is
// checked again.
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseResult, type Result } from "../../checks/lib/result";
import { runHook } from "../../checks/lib/run";
import { ALIAS, canRunLive, claudeStatus, HEADLESS, type Role } from "../../config/claude-code";
import { issue as readIssue } from "../backlog";

const ROOT = join(import.meta.dir, "..", "..");
const FINISHED = import.meta.dir;
const RECORDINGS = join(ROOT, "world", "recordings");
const args = process.argv.slice(2);
const issueNumber = Number(args.find(isIssueArgument) ?? 2);
const outDir = resolve(flag("--out") ?? join(ROOT, "runs", `finished-${issueNumber}`));
const recordAs = flag("--record");

function flag(name: string): string | undefined {
  if (!args.includes(name)) return undefined;
  return args[args.indexOf(name) + 1];
}

// The issue number is the first bare number that is not the value of a --flag.
function isIssueArgument(argument: string, index: number): boolean {
  const previous = args[index - 1];
  return /^\d+$/.test(argument) && !previous?.startsWith("--");
}

function recordingsFor(issue: number): string {
  return join(RECORDINGS, `issue-${issue}`);
}

const useColor = process.stdout.isTTY || process.env.FORCE_COLOR === "1";
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const red = paint(31);
const green = paint(32);
const dim = paint(2);

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
const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    verdict: { enum: ["pass", "block"] },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "integer" },
          evidence: { type: "string" },
        },
        required: ["file", "line", "evidence"],
      },
    },
  },
  required: ["verdict", "findings"],
};
const READ = "Read,Grep,Glob";
const WORK = "Read,Grep,Glob,Edit,Write,Bash(bun test *),Bash(bun run gate)";
const STAGES: Record<StageName, Stage> = {
  triage: {
    name: "triage",
    role: "fast",
    tools: READ,
    maxTurns: 12,
    budget: 0.5,
    schema: TRIAGE_SCHEMA,
  },
  spec: { name: "spec", role: "smart", tools: WORK, maxTurns: 30, budget: 2 },
  build: { name: "build", role: "smart", tools: WORK, maxTurns: 40, budget: 3 },
  review: {
    name: "review",
    role: "judge",
    tools: `${READ},Bash(git diff *)`,
    maxTurns: 20,
    budget: 1.5,
    schema: REVIEW_SCHEMA,
  },
};
const CAP = Number(process.env.FACTORY_CAP_USD ?? 10);

// ---------- the copy of the app every run works in ----------

type Ran = { code: number; output: string };

function runCommand(command: string[], cwd: string): Ran {
  const finished = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });
  const output = finished.stdout.toString() + finished.stderr.toString();
  return { code: finished.exitCode ?? 1, output };
}

// Every commit the factory makes has the same author and is never signed.
function runGit(repo: string, ...gitArgs: string[]): Ran {
  const identity = [
    "-c",
    "user.name=Northside factory",
    "-c",
    "user.email=factory@northside.invalid",
    "-c",
    "commit.gpgsign=false",
  ];
  return runCommand(["git", ...identity, ...gitArgs], repo);
}

function freshCopy(repo: string): void {
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(join(repo, ".factory"), { recursive: true });
  for (const part of ["src", "tests", "seed", "README.md"]) {
    cpSync(join(ROOT, "world", "app", part), join(repo, part), { recursive: true });
  }
  cpSync(join(FINISHED, "factory"), repo, { recursive: true });
  cpSync(join(ROOT, "world", "gate.ts"), join(repo, ".factory", "gate.ts"));
  runGit(repo, "init", "-q", "-b", "main");
  runGit(repo, "add", "-A");
  runGit(repo, "commit", "-q", "-m", "The lending app before the factory");
  runGit(repo, "tag", "factory-base");
  runGit(repo, "checkout", "-q", "-b", `factory/issue-${issueNumber}`);
}

// After each stage a live run saves what the stage changed as a patch, so a replay can apply it.
function snapshot(repo: string, label: string, tag?: string): void {
  runGit(repo, "add", "-A");
  if (live) {
    mkdirSync(join(outDir, "patches"), { recursive: true });
    const patch = runGit(repo, "diff", "--cached", "--binary").output;
    writeFileSync(join(outDir, "patches", `${label}.patch`), patch);
  }
  const message = `factory: ${label} for issue ${issueNumber}`;
  runGit(repo, "commit", "-q", "--allow-empty", "-m", message);
  if (tag) runGit(repo, "tag", "-f", tag);
}

// biome-ignore lint/style/useNamingConvention: world/gate.ts writes gate.json with this key.
type GateRecord = { exit_code: number; tree: string };
type GateRun = { code: number; line: string; record: GateRecord | null };

function runGate(repo: string): GateRun {
  const ran = runCommand(["bun", "run", "gate"], repo);
  const recordPath = join(repo, ".factory", "gate.json");
  let record: GateRecord | null = null;
  if (existsSync(recordPath)) record = JSON.parse(readFileSync(recordPath, "utf8"));
  const gateLines = ran.output.split("\n").filter((line) => line.startsWith("gate:"));
  const lastLine = ran.output.trim().split("\n").pop();
  return { code: ran.code, line: gateLines.pop() ?? lastLine ?? "", record };
}

// ---------- reading a stream-json transcript ----------

type Finding = { file: string; line: number; evidence: string };
type StructuredOutput = {
  type?: string;
  risk?: string;
  decision?: string;
  reason?: string;
  verdict?: "pass" | "block";
  findings?: Finding[];
};
// biome-ignore-start lint/style/useNamingConvention: Claude Code's stream-json keys are snake_case.
type ContentBlock = {
  type?: string;
  name?: string;
  input?: { file_path?: string; command?: string; pattern?: string };
  content?: string | { text?: string }[];
  is_error?: boolean;
};
type StreamEvent = {
  type?: string;
  subtype?: string;
  parent_tool_use_id?: string | null;
  message?: { content?: ContentBlock[] };
  tool_name?: string;
  decision_reason_type?: string;
  hook_event?: string;
  hook_name?: string;
  output?: string;
  stdout?: string;
  total_cost_usd?: number;
  num_turns?: number;
  structured_output?: StructuredOutput | null;
  is_error?: boolean;
  result?: unknown;
};
// biome-ignore-end lint/style/useNamingConvention: the stream-json types end here.

type Summary = {
  cost: number;
  turns: number;
  structured: StructuredOutput | null;
  isError: boolean;
  result: string;
  blocked: { tool: string; file: string; reason: string }[];
};

function emptySummary(): Summary {
  return { cost: 0, turns: 0, structured: null, isError: false, result: "", blocked: [] };
}

// The transcript records paths inside the run's copy; show them from the copy's root.
function relativePath(path: string): string {
  return String(path).replace(/^.*\/repo\//, "");
}

// Print one transcript line as it streams by, and keep what the run summary needs.
function showEvent(line: string, summary: Summary): void {
  let event: StreamEvent;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  if (event.type === "assistant" && !event.parent_tool_use_id) showToolCalls(event);
  if (event.type === "user") showBlockedEdits(event, summary);
  if (event.type === "system") showSystemEvent(event);
  if (event.type === "result") keepResult(event, summary);
}

function showToolCalls(event: StreamEvent): void {
  for (const block of event.message?.content ?? []) {
    if (block.type !== "tool_use") continue;
    let target: unknown = block.input?.command ?? block.input?.pattern ?? "";
    if (block.input?.file_path) target = relativePath(block.input.file_path);
    const firstLine = String(target).split("\n")[0];
    if (block.name !== "StructuredOutput") {
      console.log(dim(`        ${block.name} ${firstLine.slice(0, 90)}`));
    }
  }
}

function blockText(block: ContentBlock): string {
  if (typeof block.content === "string") return block.content;
  const parts = (block.content ?? []).map((part) => part.text ?? "");
  return parts.join(" ");
}

function showBlockedEdits(event: StreamEvent, summary: Summary): void {
  for (const block of event.message?.content ?? []) {
    const text = blockText(block);
    const isToolError = block.type === "tool_result" && block.is_error;
    if (!isToolError || !/Blocked: .* tests are locked/.test(text)) continue;
    const file = text.match(/Blocked: (\S+)/)?.[1] ?? "";
    summary.blocked.push({
      tool: "Edit",
      file: relativePath(file),
      reason: text.slice(text.indexOf("Blocked:")).trim(),
    });
    console.log(red(`        BLOCKED by the test-lock hook: ${relativePath(file)}`));
  }
}

function showSystemEvent(event: StreamEvent): void {
  if (event.subtype === "permission_denied") {
    const why = `is not on this stage's allow list (${event.decision_reason_type})`;
    console.log(dim(`        denied: ${event.tool_name} ${why}`));
  }
  const isStopHook = /Stop/.test(event.hook_event ?? event.hook_name ?? "");
  const blocks = /"decision":\s*"block"/.test(event.output ?? event.stdout ?? "");
  if (event.subtype === "hook_response" && isStopHook && blocks) {
    console.log(
      red("        Stop hook held the builder: the gate has not passed on this code yet"),
    );
  }
}

function keepResult(event: StreamEvent, summary: Summary): void {
  summary.cost = event.total_cost_usd ?? 0;
  summary.turns = event.num_turns ?? 0;
  summary.structured = event.structured_output ?? null;
  summary.isError = Boolean(event.is_error);
  summary.result = String(event.result ?? "");
}

// Fill the {{name}} slots of a stage prompt with the issue and any extra values.
function fillPrompt(template: string, extra: Record<string, string> = {}): string {
  const issueText = readIssue(issueNumber);
  const values: Record<string, string> = {
    number: String(issueNumber),
    title: issueText.title,
    body: issueText.body,
    feedback: "",
    ...extra,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_slot, name) => values[name] ?? "");
}

// ---------- one live stage: a real claude -p run ----------

function claudeArguments(stage: Stage, prompt: string): string[] {
  const schemaArguments = stage.schema ? ["--json-schema", JSON.stringify(stage.schema)] : [];
  return [
    "claude",
    "-p",
    prompt,
    "--model",
    ALIAS[stage.role],
    ...HEADLESS,
    "--allowedTools",
    stage.tools,
    "--max-turns",
    String(stage.maxTurns),
    "--max-budget-usd",
    String(stage.budget),
    ...schemaArguments,
  ];
}

// Write the command a person could paste to run this stage again, with the prompt as a file name.
function logCommand(stage: Stage, claudeArgv: string[]): void {
  const quoted = claudeArgv.slice(3).map((part) => (/[\s{"*(]/.test(part) ? `'${part}'` : part));
  const program = claudeArgv.slice(0, 2).join(" ");
  const promptFile = `"<world/finished/stages/${stage.name}.md>"`;
  const command = `FACTORY_STAGE=${stage.name} ${program} ${promptFile} ${quoted.join(" ")}`;
  appendFileSync(join(outDir, "commands.txt"), `${stage.name}: (cd repo && ${command})\n`);
}

// Save each line of the stream to the transcript and show it, as soon as the line is complete.
async function readStream(
  stream: ReadableStream<Uint8Array>,
  transcriptFile: string,
  summary: Summary,
): Promise<void> {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stream) {
    pending += decoder.decode(chunk);
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      appendFileSync(transcriptFile, `${line}\n`);
      showEvent(line, summary);
    }
  }
  if (pending.trim()) {
    appendFileSync(transcriptFile, `${pending}\n`);
    showEvent(pending, summary);
  }
}

async function liveStage(
  repo: string,
  stage: Stage,
  transcriptFile: string,
  extra: Record<string, string> = {},
): Promise<Summary> {
  const template = readFileSync(join(FINISHED, "stages", `${stage.name}.md`), "utf8");
  const claudeArgv = claudeArguments(stage, fillPrompt(template, extra));
  mkdirSync(dirname(transcriptFile), { recursive: true });
  mkdirSync(join(outDir, "hooks"), { recursive: true });
  writeFileSync(transcriptFile, "");
  logCommand(stage, claudeArgv);
  const hookLog = join(outDir, "hooks", `${basename(transcriptFile, ".jsonl")}.jsonl`);
  const claude = Bun.spawn(claudeArgv, {
    cwd: repo,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    // biome-ignore lint/style/useNamingConvention: the factory's hooks read these variable names.
    env: { ...process.env, FACTORY_STAGE: stage.name, FACTORY_HOOK_LOG: hookLog },
  });
  const summary = emptySummary();
  await readStream(claude.stdout, transcriptFile, summary);
  await claude.exited;
  if (claude.exitCode !== 0 && !summary.result) {
    const errorText = (await new Response(claude.stderr).text()).trim();
    const firstLine = errorText.split("\n")[0];
    console.log(red(`        claude exited ${claude.exitCode}: ${firstLine}`));
  }
  return summary;
}

// ---------- one replayed stage: the recorded transcript, then its recorded changes ----------

function replayStage(recordingDir: string, label: string): Summary {
  const summary = emptySummary();
  const transcriptFile = join(recordingDir, "transcripts", `${label}.jsonl`);
  for (const line of readFileSync(transcriptFile, "utf8").split("\n")) {
    if (line.trim()) showEvent(line, summary);
  }
  return summary;
}

function applyPatch(repo: string, recordingDir: string, label: string): void {
  const patch = join(recordingDir, "patches", `${label}.patch`);
  if (!existsSync(patch) || !readFileSync(patch, "utf8").trim()) return;
  const applied = runCommand(["git", "apply", "--whitespace=nowarn", patch], repo);
  if (applied.code !== 0) {
    throw new Error(
      `the recording no longer fits the app: ${applied.output.trim()}. ` +
        "Restore it with git checkout world/app",
    );
  }
}

// ---------- the line ----------

const replayAsked = args.includes("--replay");
const status = recordAs || replayAsked ? null : canRunLive();
const live = Boolean(recordAs) || (Boolean(status?.live) && !replayAsked);
const runName = flag("--run") ?? "run-1";
const recordingDir = join(recordingsFor(issueNumber), runName);

function recordedIssues(): string {
  if (!existsSync(RECORDINGS)) return "none";
  const issueFolders = readdirSync(RECORDINGS).filter((folder) => folder.startsWith("issue-"));
  return issueFolders.map((folder) => folder.slice(6)).join(", ");
}

if (!live && !existsSync(recordingDir)) {
  console.log(
    `finished: there is no recorded run for issue ${issueNumber} (${runName}). ` +
      `Recorded issues: ${recordedIssues()}.`,
  );
  process.exit(1);
}
if (recordAs && !canRunLive().live) {
  console.log(`finished: cannot record, ${canRunLive().why}. See world/recordings/RECORD.md.`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const repo = join(outDir, "repo");
freshCopy(repo);
const issueText = readIssue(issueNumber);
if (live) announceLiveRun();
else announceReplay();

function announceLiveRun(): void {
  const version = claudeStatus().version;
  const runInfo = {
    issue: issueNumber,
    // biome-ignore lint/style/useNamingConvention: run.json is read back with these keys.
    claude_code: version,
    // biome-ignore lint/style/useNamingConvention: run.json is read back with these keys.
    recorded_at: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(join(outDir, "run.json"), `${JSON.stringify(runInfo, null, 2)}\n`);
  console.log(
    `finished: issue ${issueNumber}, "${issueText.title}". ` +
      `Live: each stage is a real claude -p run (Claude Code ${version}).`,
  );
}

function announceReplay(): void {
  const recordedRun = JSON.parse(readFileSync(join(recordingDir, "run.json"), "utf8"));
  const reason = status ? `${status.why}` : "--replay";
  console.log(
    `finished: issue ${issueNumber}, "${issueText.title}". ` +
      `Replay of ${relative(ROOT, recordingDir)} (${reason}): ` +
      `a real claude -p run on Claude Code ${recordedRun.claude_code}; ` +
      "the gate and the hooks run again here.",
  );
}

const roles: Result["roles_by_stage"] = {};
const blocked: Result["blocked_by_hooks"] = [];
const claudeRuns: NonNullable<Result["claude_runs"]> = [];
let cost = 0;
let state: Result["state"] = "draft_pr";
let review: Result["review"] = null;
let rounds = 0;
let lastGate: GateRun | null = null;

async function runStage(
  stage: Stage,
  label: string,
  extra: Record<string, string> = {},
): Promise<Summary> {
  roles[stage.name] = stage.role;
  console.log(`\n${label.padEnd(8)} ${stage.role.padEnd(5)}`);
  const transcriptFile = join(outDir, "transcripts", `${label}.jsonl`);
  let summary: Summary;
  if (live) {
    summary = await liveStage(repo, stage, transcriptFile, extra);
  } else {
    summary = replayStage(recordingDir, label);
    mkdirSync(dirname(transcriptFile), { recursive: true });
    cpSync(join(recordingDir, "transcripts", `${label}.jsonl`), transcriptFile);
    applyPatch(repo, recordingDir, label);
  }
  cost += summary.cost;
  claudeRuns.push({
    stage: label,
    transcript: relative(outDir, transcriptFile),
    turns: summary.turns,
    // biome-ignore lint/style/useNamingConvention: result.json is a contract with snake_case keys.
    cost_usd: summary.cost,
  });
  for (const blockedEdit of summary.blocked) blocked.push({ stage: stage.name, ...blockedEdit });
  let ending = "";
  if (summary.isError) ending = `, ended with an error: ${summary.result.slice(0, 80)}`;
  console.log(dim(`        ${summary.turns} turns, $${summary.cost.toFixed(3)}${ending}`));
  return summary;
}

function overCap(): boolean {
  if (cost <= CAP) return false;
  console.log(
    red(
      `\nfinished: the run spent $${cost.toFixed(2)}, over the cap of $${CAP.toFixed(2)} ` +
        "(FACTORY_CAP_USD). Stopping.",
    ),
  );
  state = "stopped_budget";
  return true;
}

// 1. Triage
async function triage(): Promise<void> {
  const verdict = (await runStage(STAGES.triage, "triage")).structured;
  if (!verdict) {
    state = "gate_failed";
    return;
  }
  console.log(
    `        ${verdict.type}, risk ${verdict.risk}, ${verdict.decision}: ${verdict.reason}`,
  );
  if (verdict.decision === "refuse") state = "refused";
  else if (verdict.decision === "plan_only") state = "stopped_at_plan";
}

// 2. Spec: requirements and failing tests. Tests are unlocked in this stage.
async function spec(): Promise<void> {
  await runStage(STAGES.spec, "spec");
  snapshot(repo, "spec", "factory-spec");
  const specGate = runGate(repo);
  if (specGate.code === 0) {
    console.log(dim(`        ${specGate.line}`));
  } else {
    const why = " (red on purpose: the new tests fail until the build)";
    console.log(red(`        ${specGate.line}${why}`));
  }
}

// A replay runs as many build rounds as the recording has; a live run gets at most 2.
function buildRoundsAllowed(): number {
  if (live) return 2;
  const transcripts = readdirSync(join(recordingDir, "transcripts"));
  return transcripts.filter((file) => file.startsWith("build")).length;
}

// The first round is "build"; a later round is told why the gate still fails.
function buildRound(round: number): { label: string; feedback: string } {
  if (round === 1) return { label: "build", feedback: "" };
  const feedback =
    `\nThe gate still fails after your last round:\n${lastGate?.line ?? ""}\n` +
    "Fix the code under src/.";
  return { label: `build-${round}`, feedback };
}

// 3. Build: tests locked, the Stop hook holds the builder until the gate passes.
async function build(): Promise<void> {
  const roundsAllowed = buildRoundsAllowed();
  for (let round = 1; round <= roundsAllowed && !overCap(); round++) {
    rounds = round;
    const { label, feedback } = buildRound(round);
    await runStage(STAGES.build, label, { feedback });
    lastGate = runGate(repo);
    snapshot(repo, label);
    const paintGate = lastGate.code === 0 ? green : red;
    console.log(paintGate(`        ${lastGate.line}`));
    if (lastGate.code === 0) break;
  }
  if (lastGate?.code !== 0 && state === "draft_pr") state = "gate_failed";
}

// 4. Review: read only, a fresh context, a verdict with evidence.
async function reviewStage(): Promise<void> {
  const verdict = (await runStage(STAGES.review, "review")).structured;
  review = toReview(verdict);
  const paintVerdict = review?.verdict === "pass" ? green : red;
  const findingCount = review?.findings.length ?? 0;
  console.log(
    paintVerdict(`        verdict ${review?.verdict ?? "none"}, ${findingCount} findings`),
  );
  for (const finding of review?.findings ?? []) {
    console.log(red(`        ${finding.file}:${finding.line} ${finding.evidence}`));
  }
  if (review?.verdict !== "pass") state = "gate_failed";
}

function toReview(verdict: StructuredOutput | null): Result["review"] {
  if (!verdict) return null;
  return { verdict: verdict.verdict ?? "block", findings: verdict.findings ?? [] };
}

await triage();
if (state === "draft_pr" && !overCap()) await spec();
if (state === "draft_pr") await build();
if (state === "draft_pr" && !overCap()) await reviewStage();

// The hooks run again on the exact events Claude Code sent them in this run.
type HookCheck = { checked: number; differ: number };

function recheckHookLog(logFile: string, check: HookCheck): void {
  const stageName = basename(logFile)
    .replace(/\.jsonl$/, "")
    .replace(/-\d+$/, "");
  for (const line of readFileSync(logFile, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.hook_event_name !== "PreToolUse" || !event.tool_input?.file_path) continue;
    const verdict = runHook(`bun "$CLAUDE_PROJECT_DIR"/.claude/hooks/lock-tests.ts`, event, repo, {
      // biome-ignore lint/style/useNamingConvention: the hook reads these variable names.
      FACTORY_STAGE: stageName,
      // biome-ignore lint/style/useNamingConvention: the hook reads these variable names.
      FACTORY_HOOK_LOG: "",
    });
    const touchesTest = /(^|\/)tests?\//.test(String(event.tool_input?.file_path ?? ""));
    check.checked++;
    if (verdict.blocked !== (stageName === "build" && touchesTest)) check.differ++;
  }
}

function recheckHooks(): void {
  const hookDir = live ? join(outDir, "hooks") : join(recordingDir, "hooks");
  if (!existsSync(hookDir)) return;
  const check: HookCheck = { checked: 0, differ: 0 };
  for (const logName of readdirSync(hookDir)) recheckHookLog(join(hookDir, logName), check);
  let outcome = "every verdict matches";
  if (check.differ !== 0) outcome = `${check.differ} verdicts differ`;
  console.log(
    dim(
      `\nhooks    ran the test-lock hook again on the ${check.checked} file edits ` +
        `Claude Code sent it: ${outcome}`,
    ),
  );
}

recheckHooks();

// Test files the build stage changed after the spec stage wrote them.
function testsEditedInBuild(): string[] {
  if (!existsSync(join(repo, ".git"))) return [];
  const specExists = runCommand(["git", "rev-parse", "-q", "--verify", "factory-spec"], repo);
  if (specExists.code !== 0) return [];
  const changed = runCommand(["git", "diff", "--name-only", "factory-spec", "HEAD"], repo);
  return changed.output.split("\n").filter((file) => /^tests?\//.test(file));
}

const testsEdited = testsEditedInBuild();
if (testsEdited.length && state === "draft_pr") state = "gate_failed";

const prPath = join(outDir, "pr.md");
if (state === "draft_pr") writeFileSync(prPath, pullRequestBody());

function pullRequestBody(): string {
  return [
    `# Draft: ${issueText.title}`,
    "",
    `Closes #${issueNumber}. Spec: specs/${issueNumber}/SPEC.md`,
    "",
    "| Gate | Result |",
    "|---|---|",
    `| bun run gate | pass, tree ${lastGate?.record?.tree} |`,
    `| Test files edited in build | ${testsEdited.length} |`,
    `| Edits blocked by hooks | ${blocked.length} |`,
    `| Review | ${review?.verdict} |`,
    `| Cost | $${cost.toFixed(2)} |`,
    "",
    "The factory never merges. A person reviews and merges.",
    "",
  ].join("\n");
}

function gateResult(): Result["gate"] {
  const record = lastGate?.record;
  if (!record) return null;
  // biome-ignore lint/style/useNamingConvention: result.json is a contract with snake_case keys.
  return { command: "bun run gate", exit_code: record.exit_code, tree: record.tree, rounds };
}

// biome-ignore-start lint/style/useNamingConvention: result.json is a contract in snake_case.
const result: Result = {
  issue: issueNumber,
  state,
  branch: `factory/issue-${issueNumber}`,
  worktree: relative(ROOT, repo),
  pr_url: state === "draft_pr" ? relative(ROOT, prPath) : null,
  gate: gateResult(),
  review,
  tests_edited: testsEdited,
  blocked_by_hooks: blocked,
  roles_by_stage: roles,
  cost_usd: Math.round(cost * 10000) / 10000,
  replayed: !live,
  claude_runs: claudeRuns,
};
// biome-ignore-end lint/style/useNamingConvention: the contract ends here.
const check = parseResult(result);
if (!check.ok) {
  console.log(`finished: error, the result does not match the contract: ${check.why}`);
  process.exit(2);
}
writeFileSync(join(outDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);

// Keep the real run: its transcripts, the events its hooks got, the changes it made, its commands.
if (live && recordAs) {
  const destination = join(recordingsFor(issueNumber), recordAs);
  rmSync(destination, { recursive: true, force: true });
  const kept = ["run.json", "commands.txt", "transcripts", "hooks", "patches", "result.json"];
  for (const part of kept) {
    const source = join(outDir, part);
    if (existsSync(source)) cpSync(source, join(destination, part), { recursive: true });
  }
}

function plural(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

function printEnding(): void {
  const gateOutcome = lastGate?.code === 0 ? "pass" : "not passed";
  console.log(
    `\nfinished: issue ${issueNumber} ended in ${state}. ` +
      `Gate ${gateOutcome} after ${plural(rounds, "build round")}, ` +
      `${plural(blocked.length, "edit")} blocked by a hook, ` +
      `${testsEdited.length} test files edited in build, ` +
      `review ${review?.verdict ?? "not run"}, cost $${cost.toFixed(2)}.`,
  );
  let wrote = relative(ROOT, join(outDir, "result.json"));
  if (state === "draft_pr") wrote += ` and the draft PR body ${relative(ROOT, prPath)}`;
  console.log(dim(`finished: wrote ${wrote}`));
  if (recordAs) {
    const recordedInto = relative(ROOT, join(recordingsFor(issueNumber), recordAs));
    console.log(dim(`finished: recorded into ${recordedInto}`));
  }
}

printEnding();
