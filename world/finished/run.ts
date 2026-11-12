// bun run finished [issue] [--replay] [--run <name>] [--record <name>] [--out <folder>]
//
// The finished factory: one issue in, a branch whose tests pass, a review and a draft PR body out.
// Each stage is one real Claude Code run, `claude -p`, in a fresh copy of the lending app that holds the
// factory's own CLAUDE.md, .claude/settings.json and hooks (world/finished/factory/).
//
// With a signed-in `claude` on your machine it runs live. With no claude, in CI, or with --replay, it
// replays a recorded run from world/recordings/: the stream-json transcripts a real run printed and the
// changes it made. A replay applies those changes to a fresh copy, runs the gate for real, and runs the
// factory's hooks again on the exact events Claude Code sent them, so every claim is checked again.
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
const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const n = Number(args.find((a, i) => /^\d+$/.test(a) && !args[i - 1]?.startsWith("--")) ?? 2);
const out = resolve(flag("--out") ?? join(ROOT, "runs", `finished-${n}`));
const recordAs = flag("--record");
const recordingsFor = (i: number) => join(ROOT, "world", "recordings", `issue-${i}`);

const color = process.stdout.isTTY || process.env.FORCE_COLOR === "1";
const paint = (code: number) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
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
const STAGES: Stage[] = [
  { name: "triage", role: "fast", tools: READ, maxTurns: 12, budget: 0.5, schema: TRIAGE_SCHEMA },
  { name: "spec", role: "smart", tools: WORK, maxTurns: 30, budget: 2 },
  { name: "build", role: "smart", tools: WORK, maxTurns: 40, budget: 3 },
  {
    name: "review",
    role: "judge",
    tools: `${READ},Bash(git diff *)`,
    maxTurns: 20,
    budget: 1.5,
    schema: REVIEW_SCHEMA,
  },
];
const CAP = Number(process.env.FACTORY_CAP_USD ?? 10);

// ---------- the copy of the app every run works in ----------

const sh = (cmd: string[], cwd: string, env: Record<string, string> = {}) => {
  const r = Bun.spawnSync(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  return { code: r.exitCode ?? 1, out: r.stdout.toString() + r.stderr.toString() };
};
const git = (repo: string, ...a: string[]) =>
  sh(
    [
      "git",
      "-c",
      "user.name=Northside factory",
      "-c",
      "user.email=factory@northside.invalid",
      "-c",
      "commit.gpgsign=false",
      ...a,
    ],
    repo,
  );

function freshCopy(repo: string) {
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(join(repo, ".factory"), { recursive: true });
  for (const p of ["src", "tests", "seed", "README.md"])
    cpSync(join(ROOT, "world", "app", p), join(repo, p), { recursive: true });
  cpSync(join(FINISHED, "factory"), repo, { recursive: true });
  cpSync(join(ROOT, "world", "gate.ts"), join(repo, ".factory", "gate.ts"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "The lending app before the factory");
  git(repo, "tag", "factory-base");
  git(repo, "checkout", "-q", "-b", `factory/issue-${n}`);
}
// After each stage: live, save what the stage changed as a patch; replay, apply the recorded patch. Then commit.
function snapshot(repo: string, label: string, tag?: string) {
  git(repo, "add", "-A");
  if (live) {
    mkdirSync(join(out, "patches"), { recursive: true });
    writeFileSync(
      join(out, "patches", `${label}.patch`),
      git(repo, "diff", "--cached", "--binary").out,
    );
  }
  git(repo, "commit", "-q", "--allow-empty", "-m", `factory: ${label} for issue ${n}`);
  if (tag) git(repo, "tag", "-f", tag);
}
const gate = (repo: string) => {
  const r = sh(["bun", "run", "gate"], repo);
  const rec = existsSync(join(repo, ".factory", "gate.json"))
    ? JSON.parse(readFileSync(join(repo, ".factory", "gate.json"), "utf8"))
    : null;
  const line =
    r.out
      .split("\n")
      .filter((l) => l.startsWith("gate:"))
      .pop() ??
    r.out.trim().split("\n").pop() ??
    "";
  return { code: r.code, line, rec };
};

// ---------- reading a stream-json transcript ----------

type Summary = {
  cost: number;
  turns: number;
  structured: any;
  isError: boolean;
  result: string;
  blocked: { tool: string; file: string; reason: string }[];
};
function show(line: string, s: Summary) {
  let e: any;
  try {
    e = JSON.parse(line);
  } catch {
    return;
  }
  if (e.type === "assistant" && !e.parent_tool_use_id) {
    for (const c of e.message?.content ?? []) {
      if (c.type !== "tool_use") continue;
      const what = c.input?.file_path
        ? relativePath(c.input.file_path)
        : (c.input?.command ?? c.input?.pattern ?? "");
      if (c.name !== "StructuredOutput")
        console.log(dim(`        ${c.name} ${String(what).split("\n")[0].slice(0, 90)}`));
    }
  }
  if (e.type === "user") {
    for (const c of e.message?.content ?? []) {
      const text =
        typeof c.content === "string"
          ? c.content
          : (c.content ?? []).map((x: any) => x.text ?? "").join(" ");
      if (c.type === "tool_result" && c.is_error && /Blocked: .* tests are locked/.test(text)) {
        const file = text.match(/Blocked: (\S+)/)?.[1] ?? "";
        s.blocked.push({
          tool: "Edit",
          file: relativePath(file),
          reason: text.slice(text.indexOf("Blocked:")).trim(),
        });
        console.log(red(`        BLOCKED by the test-lock hook: ${relativePath(file)}`));
      }
    }
  }
  if (e.type === "system" && e.subtype === "permission_denied") {
    console.log(
      dim(
        `        denied: ${e.tool_name} is not on this stage's allow list (${e.decision_reason_type})`,
      ),
    );
  }
  if (
    e.type === "system" &&
    e.subtype === "hook_response" &&
    /Stop/.test(e.hook_event ?? e.hook_name ?? "") &&
    /"decision":\s*"block"/.test(e.output ?? e.stdout ?? "")
  ) {
    console.log(
      red("        Stop hook held the builder: the gate has not passed on this code yet"),
    );
  }
  if (e.type === "result") {
    s.cost = e.total_cost_usd ?? 0;
    s.turns = e.num_turns ?? 0;
    s.structured = e.structured_output ?? null;
    s.isError = Boolean(e.is_error);
    s.result = String(e.result ?? "");
  }
}
const relativePath = (p: string) => String(p).replace(/^.*\/repo\//, "");
const blank = (): Summary => ({
  cost: 0,
  turns: 0,
  structured: null,
  isError: false,
  result: "",
  blocked: [],
});

function fill(template: string, extra: Record<string, string> = {}) {
  const i = readIssue(n);
  const vars: Record<string, string> = {
    number: String(n),
    title: i.title,
    body: i.body,
    feedback: "",
    ...extra,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

// ---------- one live stage: a real claude -p run ----------

async function liveStage(
  repo: string,
  st: Stage,
  file: string,
  extra: Record<string, string> = {},
): Promise<Summary> {
  const prompt = fill(readFileSync(join(FINISHED, "stages", `${st.name}.md`), "utf8"), extra);
  const argv = [
    "claude",
    "-p",
    prompt,
    "--model",
    ALIAS[st.role],
    ...HEADLESS,
    "--allowedTools",
    st.tools,
    "--max-turns",
    String(st.maxTurns),
    "--max-budget-usd",
    String(st.budget),
    ...(st.schema ? ["--json-schema", JSON.stringify(st.schema)] : []),
  ];
  mkdirSync(dirname(file), { recursive: true });
  mkdirSync(join(out, "hooks"), { recursive: true });
  writeFileSync(file, "");
  appendFileSync(
    join(out, "commands.txt"),
    `${st.name}: (cd repo && FACTORY_STAGE=${st.name} ${argv.slice(0, 2).join(" ")} "<world/finished/stages/${st.name}.md>" ${argv
      .slice(3)
      .map((a) => (/[\s{"*(]/.test(a) ? `'${a}'` : a))
      .join(" ")})\n`,
  );
  const p = Bun.spawn(argv, {
    cwd: repo,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      FACTORY_STAGE: st.name,
      FACTORY_HOOK_LOG: join(out, "hooks", `${basename(file, ".jsonl")}.jsonl`),
    },
  });
  const s = blank();
  let buf = "";
  const dec = new TextDecoder();
  for await (const chunk of p.stdout) {
    buf += dec.decode(chunk);
    let k: number;
    while ((k = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, k);
      buf = buf.slice(k + 1);
      if (!line.trim()) continue;
      appendFileSync(file, `${line}\n`);
      show(line, s);
    }
  }
  if (buf.trim()) {
    appendFileSync(file, `${buf}\n`);
    show(buf, s);
  }
  await p.exited;
  if (p.exitCode !== 0 && !s.result) {
    const err = (await new Response(p.stderr).text()).trim();
    console.log(red(`        claude exited ${p.exitCode}: ${err.split("\n")[0]}`));
  }
  return s;
}

// ---------- one replayed stage: the recorded transcript, then its recorded changes ----------

function replayStage(repo: string, recDir: string, name: string): Summary {
  const s = blank();
  const file = join(recDir, "transcripts", `${name}.jsonl`);
  for (const line of readFileSync(file, "utf8").split("\n")) if (line.trim()) show(line, s);
  return s;
}
const applyPatch = (repo: string, recDir: string, name: string) => {
  const patch = join(recDir, "patches", `${name}.patch`);
  if (!existsSync(patch) || !readFileSync(patch, "utf8").trim()) return;
  const r = sh(["git", "apply", "--whitespace=nowarn", patch], repo);
  if (r.code !== 0)
    throw new Error(
      `the recording no longer fits the app: ${r.out.trim()}. Restore it with git checkout world/app`,
    );
};

// ---------- the line ----------

const status = recordAs || args.includes("--replay") ? null : canRunLive();
const live = Boolean(recordAs) || (Boolean(status?.live) && !args.includes("--replay"));
const runName = flag("--run") ?? "run-1";
const recDir = join(recordingsFor(n), runName);
if (!live && !existsSync(recDir)) {
  console.log(
    `finished: there is no recorded run for issue ${n} (${runName}). Recorded issues: ${
      existsSync(join(ROOT, "world", "recordings"))
        ? readdirSync(join(ROOT, "world", "recordings"))
            .filter((d) => d.startsWith("issue-"))
            .map((d) => d.slice(6))
            .join(", ")
        : "none"
    }.`,
  );
  process.exit(1);
}
if (recordAs && !canRunLive().live) {
  console.log(`finished: cannot record, ${canRunLive().why}. See world/recordings/RECORD.md.`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const repo = join(out, "repo");
freshCopy(repo);
const issueText = readIssue(n);
if (live) {
  const s = claudeStatus();
  writeFileSync(
    join(out, "run.json"),
    `${JSON.stringify({ issue: n, claude_code: s.version, recorded_at: new Date().toISOString().slice(0, 10) }, null, 2)}\n`,
  );
  console.log(
    `finished: issue ${n}, "${issueText.title}". Live: each stage is a real claude -p run (Claude Code ${s.version}).`,
  );
} else {
  const meta = JSON.parse(readFileSync(join(recDir, "run.json"), "utf8"));
  console.log(
    `finished: issue ${n}, "${issueText.title}". Replay of ${relative(ROOT, recDir)} (${status ? `${status.why}` : "--replay"}): a real claude -p run on Claude Code ${meta.claude_code}; the gate and the hooks run again here.`,
  );
}

const roles: Result["roles_by_stage"] = {};
const blocked: Result["blocked_by_hooks"] = [];
const claudeRuns: NonNullable<Result["claude_runs"]> = [];
let cost = 0;
let state: Result["state"] = "draft_pr";
let review: Result["review"] = null;
let rounds = 0;
let lastGate: ReturnType<typeof gate> | null = null;

async function stage(
  st: Stage,
  label: string,
  extra: Record<string, string> = {},
): Promise<Summary> {
  roles[st.name] = st.role;
  console.log(`\n${label.padEnd(8)} ${st.role.padEnd(5)}`);
  const transcript = join(out, "transcripts", `${label}.jsonl`);
  const s = live ? await liveStage(repo, st, transcript, extra) : replayStage(repo, recDir, label);
  if (!live) {
    mkdirSync(dirname(transcript), { recursive: true });
    cpSync(join(recDir, "transcripts", `${label}.jsonl`), transcript);
    applyPatch(repo, recDir, label);
  }
  cost += s.cost;
  claudeRuns.push({
    stage: label,
    transcript: relative(out, transcript),
    turns: s.turns,
    cost_usd: s.cost,
  });
  for (const b of s.blocked) blocked.push({ stage: st.name, ...b });
  console.log(
    dim(
      `        ${s.turns} turns, $${s.cost.toFixed(3)}${s.isError ? `, ended with an error: ${s.result.slice(0, 80)}` : ""}`,
    ),
  );
  return s;
}
const byName = (x: StageName) => STAGES.find((s) => s.name === x)!;
const overCap = () => {
  if (cost <= CAP) return false;
  console.log(
    red(
      `\nfinished: the run spent $${cost.toFixed(2)}, over the cap of $${CAP.toFixed(2)} (FACTORY_CAP_USD). Stopping.`,
    ),
  );
  state = "stopped_budget";
  return true;
};

// 1. Triage
const t = await stage(byName("triage"), "triage");
const tri = t.structured;
if (tri) console.log(`        ${tri.type}, risk ${tri.risk}, ${tri.decision}: ${tri.reason}`);
if (!tri) state = "gate_failed";
else if (tri.decision === "refuse") state = "refused";
else if (tri.decision === "plan_only") state = "stopped_at_plan";

// 2. Spec: requirements and failing tests. Tests are unlocked in this stage.
if (state === "draft_pr" && !overCap()) {
  await stage(byName("spec"), "spec");
  snapshot(repo, "spec", "factory-spec");
  const g = gate(repo);
  console.log(
    (g.code === 0 ? dim : red)(
      `        ${g.line}${g.code === 0 ? "" : " (red on purpose: the new tests fail until the build)"}`,
    ),
  );
}

// 3. Build: tests locked, the Stop hook holds the builder until the gate passes. At most 2 rounds.
if (state === "draft_pr") {
  const roundsDone = live
    ? 2
    : readdirSync(join(recDir, "transcripts")).filter((f) => f.startsWith("build")).length;
  for (let r = 1; r <= roundsDone && !overCap(); r++) {
    rounds = r;
    const label = r === 1 ? "build" : `build-${r}`;
    const feedback =
      r === 1
        ? ""
        : `\nThe gate still fails after your last round:\n${lastGate?.line ?? ""}\nFix the code under src/.`;
    await stage(byName("build"), label, { feedback });
    lastGate = gate(repo);
    snapshot(repo, label);
    console.log((lastGate.code === 0 ? green : red)(`        ${lastGate.line}`));
    if (lastGate.code === 0) break;
  }
  if (lastGate?.code !== 0 && state === "draft_pr") state = "gate_failed";
}

// 4. Review: read only, a fresh context, a verdict with evidence.
if (state === "draft_pr" && !overCap()) {
  const r = await stage(byName("review"), "review");
  review = r.structured
    ? { verdict: r.structured.verdict, findings: r.structured.findings ?? [] }
    : null;
  console.log(
    (review?.verdict === "pass" ? green : red)(
      `        verdict ${review?.verdict ?? "none"}, ${review?.findings.length ?? 0} findings`,
    ),
  );
  for (const f of review?.findings ?? [])
    console.log(red(`        ${f.file}:${f.line} ${f.evidence}`));
  if (review?.verdict !== "pass") state = "gate_failed";
}

// The hooks run again on the exact events Claude Code sent them in this run.
const hookDir = live ? join(out, "hooks") : join(recDir, "hooks");
let hookChecks = 0;
let hookMismatch = 0;
if (existsSync(hookDir)) {
  for (const f of readdirSync(hookDir)) {
    const stageName = f.replace(/\.jsonl$/, "").replace(/-\d+$/, "");
    for (const line of readFileSync(join(hookDir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      if (ev.hook_event_name !== "PreToolUse" || !ev.tool_input?.file_path) continue;
      const v = runHook(`bun "$CLAUDE_PROJECT_DIR"/.claude/hooks/lock-tests.ts`, ev, repo, {
        FACTORY_STAGE: stageName,
        FACTORY_HOOK_LOG: "",
      });
      const touchesTest = /(^|\/)tests?\//.test(String(ev.tool_input?.file_path ?? ""));
      hookChecks++;
      if (v.blocked !== (stageName === "build" && touchesTest)) hookMismatch++;
    }
  }
  console.log(
    dim(
      `\nhooks    ran the test-lock hook again on the ${hookChecks} file edits Claude Code sent it: ${hookMismatch === 0 ? "every verdict matches" : `${hookMismatch} verdicts differ`}`,
    ),
  );
}

const testsEdited = existsSync(join(repo, ".git"))
  ? sh(["git", "diff", "--name-only", "factory-spec", "HEAD"], repo)
      .out.split("\n")
      .filter((f) => /^tests?\//.test(f))
  : [];
if (sh(["git", "rev-parse", "-q", "--verify", "factory-spec"], repo).code !== 0)
  testsEdited.length = 0;
if (testsEdited.length && state === "draft_pr") state = "gate_failed";

const prPath = join(out, "pr.md");
if (state === "draft_pr")
  writeFileSync(
    prPath,
    `# Draft: ${issueText.title}\n\nCloses #${n}. Spec: specs/${n}/SPEC.md\n\n| Gate | Result |\n|---|---|\n| bun run gate | pass, tree ${lastGate?.rec?.tree} |\n| Test files edited in build | ${testsEdited.length} |\n| Edits blocked by hooks | ${blocked.length} |\n| Review | ${review?.verdict} |\n| Cost | $${cost.toFixed(2)} |\n\nThe factory never merges. A person reviews and merges.\n`,
  );
const result: Result = {
  issue: n,
  state,
  branch: `factory/issue-${n}`,
  worktree: relative(ROOT, repo),
  pr_url: state === "draft_pr" ? relative(ROOT, prPath) : null,
  gate: lastGate?.rec
    ? {
        command: "bun run gate",
        exit_code: lastGate.rec.exit_code,
        tree: lastGate.rec.tree,
        rounds,
      }
    : null,
  review,
  tests_edited: testsEdited,
  blocked_by_hooks: blocked,
  roles_by_stage: roles,
  cost_usd: Math.round(cost * 10000) / 10000,
  replayed: !live,
  claude_runs: claudeRuns,
};
const check = parseResult(result);
if (!check.ok) {
  console.log(`finished: error, the result does not match the contract: ${check.why}`);
  process.exit(2);
}
writeFileSync(join(out, "result.json"), `${JSON.stringify(result, null, 2)}\n`);

if (live && recordAs) {
  // Keep the real run: its transcripts, the events its hooks got, the changes it made, the commands it ran.
  const dest = join(recordingsFor(n), recordAs);
  rmSync(dest, { recursive: true, force: true });
  for (const p of ["run.json", "commands.txt", "transcripts", "hooks", "patches", "result.json"])
    if (existsSync(join(out, p))) cpSync(join(out, p), join(dest, p), { recursive: true });
}

console.log(
  `\nfinished: issue ${n} ended in ${state}. Gate ${lastGate?.code === 0 ? "pass" : "not passed"} after ${rounds} build round${rounds === 1 ? "" : "s"}, ${blocked.length} edit${blocked.length === 1 ? "" : "s"} blocked by a hook, ${testsEdited.length} test files edited in build, review ${review?.verdict ?? "not run"}, cost $${cost.toFixed(2)}.`,
);
console.log(
  dim(
    `finished: wrote ${relative(ROOT, join(out, "result.json"))}${state === "draft_pr" ? ` and the draft PR body ${relative(ROOT, prPath)}` : ""}`,
  ),
);
if (recordAs)
  console.log(dim(`finished: recorded into ${relative(ROOT, join(recordingsFor(n), recordAs))}`));
