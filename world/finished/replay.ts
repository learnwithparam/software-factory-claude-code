// bun run factory:replay <issue> [--out <folder>]
// Replays a recorded run of the finished factory with no key and no spend. The model replies and their costs
// come from recordings/; everything else is real: each recorded tool call goes through the factory's hooks,
// the gate runs the app's tests on a copy of the app, and the result file is checked against the contract.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseResult, type Result } from "../../checks/lib/result";
import { hooksFor, runHook } from "../../checks/lib/run";
import { treeHash } from "../gate";

const ROOT = join(import.meta.dir, "..", "..");
const args = process.argv.slice(2);
const n = Number(args[0]);
const out = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : join(ROOT, "runs", `replay-${n}`));
const recording = join(import.meta.dir, "recordings", `issue-${n}.json`);
const color = process.stdout.isTTY || process.env.FORCE_COLOR === "1";
const red = (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s: string) => (color ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s: string) => (color ? `\x1b[2m${s}\x1b[0m` : s);

if (!existsSync(recording)) {
  console.log(`replay: there is no recorded run for issue ${args[0] ?? "(none)"}. Try: bun run factory:replay 2`);
  process.exit(1);
}
const rec = JSON.parse(readFileSync(recording, "utf8"));
const settings = JSON.parse(readFileSync(join(import.meta.dir, "settings.json"), "utf8"));

// A fresh copy of the app stands in for the builder's worktree.
rmSync(out, { recursive: true, force: true });
const tree = join(out, "worktree");
mkdirSync(tree, { recursive: true });
for (const p of ["src", "tests", "seed", "README.md"]) cpSync(join(ROOT, "world", "app", p), join(tree, p), { recursive: true });

const gate = (round: number) => {
  const r = Bun.spawnSync(["bun", join(ROOT, "world", "gate.ts"), tree, "--record", join(out, "gate.json")], { stdout: "pipe", stderr: "pipe" });
  const line = r.stdout.toString().trim().split("\n").pop() ?? "";
  return { code: r.exitCode, line, round };
};

const blocked: Result["blocked_by_hooks"] = [];
const testsEdited: string[] = [];
const roles: Record<string, "fast" | "smart" | "judge" | "none"> = {};
let cost = 0;
let rounds = 0;
let review: Result["review"] = null;

console.log(`replay: issue ${n}, "${rec.note.split(".")[0]}"`);
for (const s of rec.stages) {
  roles[s.stage] = s.role;
  cost += s.cost_usd;
  console.log(`\n${s.stage.padEnd(7)} role ${s.role.padEnd(5)} $${s.cost_usd.toFixed(2)}  ${s.reply.split("\n")[0]}`);
  if (s.stage === "triage") for (const l of s.reply.split("\n").slice(1)) console.log(dim(`        ${l}`));
  for (const w of s.writes ?? []) {
    const p = join(out, w.file);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, w.content);
    console.log(dim(`        wrote ${relative(ROOT, p)}`));
  }
  for (const call of s.tool_calls ?? []) {
    const event = { hook_event_name: "PreToolUse", session_id: `replay-${n}`, cwd: tree, tool_name: call.tool_name, tool_input: call.tool_input };
    const verdicts = hooksFor(settings, "PreToolUse", call.tool_name).map((cmd) => runHook(cmd, event, ROOT, { FACTORY_STAGE: s.stage }));
    const stop = verdicts.find((v) => v.blocked);
    const file = call.tool_input.file_path;
    if (stop) {
      blocked.push({ stage: s.stage, tool: call.tool_name, file, reason: stop.reason });
      console.log(red(`        BLOCKED ${call.tool_name} ${file}`));
      console.log(red(`        hook said: ${stop.reason}`));
      continue;
    }
    const target = join(tree, file);
    const before = readFileSync(target, "utf8");
    if (!before.includes(call.tool_input.old_string)) throw new Error(`recording is stale: ${file} no longer has the text it edits`);
    writeFileSync(target, before.replace(call.tool_input.old_string, call.tool_input.new_string));
    if (/tests?\//.test(file) && s.stage === "build") testsEdited.push(file);
    console.log(green(`        allowed ${call.tool_name} ${file}`));
  }
  if (s.stage === "spec") {
    const g = gate(0);
    console.log((g.code === 0 ? dim : red)(`        ${g.line} ${g.code === 0 ? "" : "(red on purpose: the new test fails until the build)"}`));
  }
  if (s.stage === "build") {
    rounds++;
    const g = gate(rounds);
    console.log((g.code === 0 ? green : red)(`        ${g.line}`));
    const stopEvent = { hook_event_name: "Stop", session_id: `replay-${n}`, stop_hook_active: false };
    const stops = hooksFor(settings, "Stop").map((cmd) => runHook(cmd, stopEvent, ROOT, { FACTORY_RUN_DIR: out, FACTORY_APP_DIR: tree }));
    const held = stops.find((v) => v.blocked);
    console.log(held ? red(`        Stop hook held the builder: ${held.reason}`) : green("        Stop hook let the builder stop: the gate passed on the current tree"));
  }
  if (s.stage === "review") {
    review = JSON.parse(s.reply);
    console.log((review?.verdict === "pass" ? green : red)(`        verdict ${review?.verdict}, ${review?.findings.length} findings`));
  }
}

const gateRec = JSON.parse(readFileSync(join(out, "gate.json"), "utf8"));
const passed = gateRec.exit_code === 0 && gateRec.tree === treeHash(tree);
const prPath = join(out, "pr.md");
writeFileSync(
  prPath,
  `# Draft: Fix issue ${n}\n\nCloses #${n}. Spec: specs/${n}/SPEC.md\n\n| Gate | Result |\n|---|---|\n| bun run gate | ${passed ? "pass" : "fail"}, tree ${gateRec.tree} |\n| Test files edited in build | ${testsEdited.length} |\n| Edits blocked by hooks | ${blocked.length} |\n| Review | ${review?.verdict} |\n| Cost | $${cost.toFixed(2)} |\n\nThe factory never merges. A person reviews and merges.\n`,
);
const result: Result = {
  issue: n,
  state: passed && review?.verdict === "pass" ? "draft_pr" : "gate_failed",
  branch: `factory/issue-${n}`,
  worktree: relative(ROOT, tree),
  pr_url: relative(ROOT, prPath),
  gate: { command: "bun run gate", exit_code: gateRec.exit_code, tree: gateRec.tree, rounds },
  review,
  tests_edited: testsEdited,
  blocked_by_hooks: blocked,
  roles_by_stage: roles,
  cost_usd: Math.round(cost * 100) / 100,
  replayed: true,
};
const check = parseResult(result);
if (!check.ok) {
  console.log(`replay: error, the result does not match the contract: ${check.why}`);
  process.exit(2);
}
writeFileSync(join(out, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `\nreplay: issue ${n} ended in ${result.state}. Gate ${passed ? "pass" : "fail"} after ${rounds} build round, ${blocked.length} edit blocked by a hook, ${testsEdited.length} test files edited in build, review ${review?.verdict}, recorded cost $${result.cost_usd.toFixed(2)}.`,
);
console.log(dim(`replay: wrote ${relative(ROOT, join(out, "result.json"))} and the draft PR body ${relative(ROOT, prPath)}`));
