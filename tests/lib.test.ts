// Tests for checks/lib and the finished factory. `bun test` runs them with no key and no claude.
// The hook tests feed the factory's hooks the exact JSON Claude Code sent them
// during the recorded runs in world/recordings/
// (each hooks/<stage>.jsonl line is one event, as it arrived on stdin).
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frontmatter, sections } from "../checks/lib/files";
import { decide } from "../checks/lib/permissions";
import { parseResult } from "../checks/lib/result";
import { hooksFor, runCommand, runHook } from "../checks/lib/run";
import { requirementLines } from "../checks/lib/spec";
import { appFiles, issue, issues, ROOT } from "../checks/lib/world";
import { treeHash } from "../world/gate";

// A hook event as Claude Code sends it.
type HookEvent = Record<string, unknown> & {
  // biome-ignore-start lint/style/useNamingConvention: Claude Code names these keys.
  tool_name?: string;
  tool_input: { file_path: string; command?: string };
  hook_event_name?: string;
  // biome-ignore-end lint/style/useNamingConvention: the hook event keys end here.
};

const FACTORY = join(ROOT, "world/finished/factory");
const settings = JSON.parse(readFileSync(join(FACTORY, ".claude/settings.json"), "utf8"));
const RUN = join(ROOT, "world/recordings/issue-2/run-1");

function events(stage: string): HookEvent[] {
  const text = readFileSync(join(RUN, "hooks", `${stage}.jsonl`), "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function realEdit(stage: string, file: RegExp): HookEvent | undefined {
  return events(stage).find(
    (event) => event.tool_name === "Edit" && file.test(event.tool_input.file_path),
  );
}

function realStop(): HookEvent | undefined {
  return events("build").find((event) => event.hook_event_name === "Stop");
}

// The environment a hook sees during one stage of a factory run.
function inStage(stage: string): Record<string, string> {
  // biome-ignore lint/style/useNamingConvention: the factory reads this environment variable.
  return { FACTORY_STAGE: stage };
}

// A project folder laid out like a factory run: the app, the factory's .claude/, and the gate.
function project() {
  const folder = mkdtempSync(join(tmpdir(), "factory-"));
  for (const part of ["src", "tests", "seed"]) {
    cpSync(join(ROOT, "world/app", part), join(folder, part), { recursive: true });
  }
  cpSync(FACTORY, folder, { recursive: true });
  mkdirSync(join(folder, ".factory"), { recursive: true });
  cpSync(join(ROOT, "world/gate.ts"), join(folder, ".factory/gate.ts"));
  return folder;
}
const lockTests = hooksFor(settings, "PreToolUse", "Edit")[0];
const stopGate = hooksFor(settings, "Stop")[0];

test("the backlog has seven issues and issue 6 names the protected path", () => {
  expect(issues().map((backlogIssue) => backlogIssue.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(issue(6).body).toContain("src/auth/");
  expect(appFiles()).toContain("src/fees/split.ts");
});

test("the recorded events are what Claude Code sends a PreToolUse and a Stop hook", () => {
  const edit = realEdit("spec", /tests\/fees\/split\.test\.ts$/);
  expect(edit).toBeDefined();
  for (const key of [
    "session_id",
    "transcript_path",
    "cwd",
    "permission_mode",
    "hook_event_name",
    "tool_name",
    "tool_input",
    "tool_use_id",
  ]) {
    expect(Object.keys(edit ?? {})).toContain(key);
  }
  expect(edit?.hook_event_name).toBe("PreToolUse");
  // biome-ignore lint/style/useNamingConvention: Claude Code names these keys.
  expect(realStop()).toMatchObject({ hook_event_name: "Stop", stop_hook_active: false });
});

test("the test-lock hook blocks the real test edit in build and allows it in spec", () => {
  const folder = project();
  const testEdit = realEdit("spec", /tests\/fees\/split\.test\.ts$/) as HookEvent;
  const inBuild = runHook(lockTests, testEdit, folder, inStage("build"));
  expect(inBuild.code).toBe(2);
  expect(inBuild.reason).toContain("tests are locked");
  expect(runHook(lockTests, testEdit, folder, inStage("spec")).blocked).toBe(false);
  const codeEdit = realEdit("build", /src\/fees\/split\.ts$/) as HookEvent;
  expect(runHook(lockTests, codeEdit, folder, inStage("build")).blocked).toBe(false);
});

const SHELL_WRITE_TEST =
  "the test-lock hook blocks a shell write to a test file " +
  "(a real Bash event, its command changed)";

test(SHELL_WRITE_TEST, () => {
  const real = events("build").find((event) => event.tool_name === "Bash") as HookEvent;
  const shellWrite = {
    ...real,
    // biome-ignore lint/style/useNamingConvention: Claude Code names this key.
    tool_input: { ...real.tool_input, command: "sed -i 's/1667/1666/' tests/fees/split.test.ts" },
  };
  const bashHook = hooksFor(settings, "PreToolUse", "Bash")[0];
  const verdict = runHook(bashHook, shellWrite, project(), inStage("build"));
  expect(verdict.blocked).toBe(true);
  expect(verdict.reason).toContain("locked");
});

test("the Stop hook holds the builder until the gate passed on the code as it is", () => {
  const folder = project();
  const stop = realStop() as HookEvent;
  const build = inStage("build");
  const first = runHook(stopGate, stop, folder, build);
  expect(first.json?.decision).toBe("block");
  // biome-ignore lint/style/useNamingConvention: Claude Code names this key.
  const stopAgain = { ...stop, stop_hook_active: true };
  expect(runHook(stopGate, stopAgain, folder, build).blocked).toBe(false);
  expect(runHook(stopGate, stop, folder, inStage("review")).blocked).toBe(false);
  expect(runCommand(["bun", "run", "gate"], { cwd: folder }).code).toBe(0);
  expect(runHook(stopGate, stop, folder, build).blocked).toBe(false);
  const codePath = join(folder, "src/fees/split.ts");
  writeFileSync(codePath, `${readFileSync(codePath, "utf8")}\n// changed after the gate\n`);
  expect(runHook(stopGate, stop, folder, build).reason).toContain(
    "changed after the last gate run",
  );
}, 30000);

test("the Stop hook and the gate hash the same tree", async () => {
  const folder = project();
  runCommand(["bun", "run", "gate"], { cwd: folder });
  const gateRecord = JSON.parse(readFileSync(join(folder, ".factory/gate.json"), "utf8"));
  expect(gateRecord.tree).toBe(treeHash(folder));
}, 30000);

function bash(command: string) {
  return { tool: "Bash", input: { command } };
}

function fileCall(tool: string, path: string) {
  // biome-ignore lint/style/useNamingConvention: Claude Code names this key.
  return { tool, input: { file_path: path } };
}

test("permission rules: deny wins, the grammar matches prefixes, and src/auth/ is denied", () => {
  expect(decide(settings, bash("git push --force origin main"))).toBe("deny");
  expect(decide(settings, bash("git commit -m x --no-verify"))).toBe("deny");
  expect(decide(settings, fileCall("Read", ".env.local"))).toBe("deny");
  expect(decide(settings, fileCall("Edit", "src/auth/roles.ts"))).toBe("deny");
  expect(decide(settings, bash("bun test tests/fees"))).toBe("allow");
  const allowBashButNotRemove = { permissions: { allow: ["Bash"], deny: ["Bash(rm:*)"] } };
  expect(decide(allowBashButNotRemove, bash("rm x"))).toBe("deny");
});

test("frontmatter and sections read what a learner writes", () => {
  const folder = mkdtempSync(join(tmpdir(), "fm-"));
  writeFileSync(
    join(folder, "SKILL.md"),
    "---\nname: triage\nallowed-tools: Read, Grep\n---\n# Triage\n\n## Reply\n\nTYPE:\n",
  );
  expect(frontmatter(join(folder, "SKILL.md"))?.data.name).toBe("triage");
  expect(sections("# A\n\n## Outcome\n\nx\n## Done when\n- y").get("done when")).toBe("- y");
  expect(
    requirementLines(
      "## Requirements\n\n- R1. When a, the system shall b.\n- R2: If c, the system shall d.",
    ),
  ).toHaveLength(2);
});

// Replay a recorded run of the finished factory into a fresh folder and read what it wrote.
function replay(issueNumber: number, run: string) {
  const outputFolder = join(mkdtempSync(join(tmpdir(), "finished-")), "run");
  const finishedRun = join(ROOT, "world/finished/run.ts");
  const replayed = runCommand([
    "bun",
    finishedRun,
    String(issueNumber),
    "--replay",
    "--run",
    run,
    "--out",
    outputFolder,
  ]);
  const resultText = readFileSync(join(outputFolder, "result.json"), "utf8");
  const parsed = parseResult(JSON.parse(resultText));
  if (!parsed.ok) throw new Error(parsed.why);
  return { stdout: replayed.stdout, result: parsed.result };
}

// Behaviour that varies run to run is judged over the 3 recorded runs: each must reach a draft PR
// with the gate green, no test edited in the build, and the review passing.
for (const run of ["run-1", "run-2", "run-3"]) {
  test(`the recorded ${run} of issue 2 replays to a draft PR with the gate green`, () => {
    const { stdout, result } = replay(2, run);
    expect(stdout).toContain("ended in draft_pr");
    expect(stdout).toContain("every verdict matches");
    expect(result.replayed).toBe(true);
    expect(result.gate?.exit_code).toBe(0);
    expect(result.tests_edited).toEqual([]);
    expect(result.review?.verdict).toBe("pass");
    const stages = result.claude_runs?.map((claudeRun) => claudeRun.stage);
    expect(stages).toEqual(["triage", "spec", "build", "review"]);
    expect(result.cost_usd).toBeGreaterThan(0);
  }, 60000);
}

test("the recorded run of issue 6 is refused at triage: it needs src/auth/", () => {
  const { result } = replay(6, "run-1");
  expect(result.state).toBe("refused");
  expect(result.claude_runs?.map((claudeRun) => claudeRun.stage)).toEqual(["triage"]);
}, 30000);
