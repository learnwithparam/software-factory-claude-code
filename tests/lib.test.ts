// Tests for checks/lib and the finished factory. `bun test` runs them with no key and no claude.
// The hook tests feed the factory's hooks the exact JSON Claude Code sent them during the recorded runs in
// world/recordings/ (each hooks/<stage>.jsonl line is one event, as it arrived on stdin).
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frontmatter, sections } from "../checks/lib/files";
import { decide } from "../checks/lib/permissions";
import { parseResult } from "../checks/lib/result";
import { hooksFor, runHook, sh } from "../checks/lib/run";
import { requirementLines } from "../checks/lib/spec";
import { appFiles, issue, issues, ROOT } from "../checks/lib/world";
import { treeHash } from "../world/gate";

const FACTORY = join(ROOT, "world/finished/factory");
const settings = JSON.parse(readFileSync(join(FACTORY, ".claude/settings.json"), "utf8"));
const RUN = join(ROOT, "world/recordings/issue-2/run-1");
const events = (stage: string) =>
  readFileSync(join(RUN, "hooks", `${stage}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const realEdit = (stage: string, file: RegExp) =>
  events(stage).find((e) => e.tool_name === "Edit" && file.test(e.tool_input.file_path));
const realStop = () => events("build").find((e) => e.hook_event_name === "Stop");

// A project folder laid out like a factory run: the app, the factory's .claude/, and the gate.
function project() {
  const dir = mkdtempSync(join(tmpdir(), "factory-"));
  for (const p of ["src", "tests", "seed"])
    cpSync(join(ROOT, "world/app", p), join(dir, p), { recursive: true });
  cpSync(FACTORY, dir, { recursive: true });
  mkdirSync(join(dir, ".factory"), { recursive: true });
  cpSync(join(ROOT, "world/gate.ts"), join(dir, ".factory/gate.ts"));
  return dir;
}
const lockTests = hooksFor(settings, "PreToolUse", "Edit")[0];
const stopGate = hooksFor(settings, "Stop")[0];

test("the backlog has seven issues and issue 6 names the protected path", () => {
  expect(issues().map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(issue(6).body).toContain("src/auth/");
  expect(appFiles()).toContain("src/fees/split.ts");
});

test("the recorded events are what Claude Code sends a PreToolUse and a Stop hook", () => {
  const e = realEdit("spec", /tests\/fees\/split\.test\.ts$/);
  expect(e).toBeDefined();
  for (const k of [
    "session_id",
    "transcript_path",
    "cwd",
    "permission_mode",
    "hook_event_name",
    "tool_name",
    "tool_input",
    "tool_use_id",
  ])
    expect(Object.keys(e)).toContain(k);
  expect(e.hook_event_name).toBe("PreToolUse");
  expect(realStop()).toMatchObject({ hook_event_name: "Stop", stop_hook_active: false });
});

test("the test-lock hook blocks the real test edit in build and allows it in spec", () => {
  const dir = project();
  const e = realEdit("spec", /tests\/fees\/split\.test\.ts$/);
  const inBuild = runHook(lockTests, e, dir, { FACTORY_STAGE: "build" });
  expect(inBuild.code).toBe(2);
  expect(inBuild.reason).toContain("tests are locked");
  expect(runHook(lockTests, e, dir, { FACTORY_STAGE: "spec" }).blocked).toBe(false);
  expect(
    runHook(lockTests, realEdit("build", /src\/fees\/split\.ts$/), dir, { FACTORY_STAGE: "build" })
      .blocked,
  ).toBe(false);
});

test("the test-lock hook blocks a shell write to a test file (a real Bash event, its command changed)", () => {
  const real = events("build").find((e) => e.tool_name === "Bash");
  const ev = {
    ...real,
    tool_input: { ...real.tool_input, command: "sed -i 's/1667/1666/' tests/fees/split.test.ts" },
  };
  const v = runHook(hooksFor(settings, "PreToolUse", "Bash")[0], ev, project(), {
    FACTORY_STAGE: "build",
  });
  expect(v.blocked).toBe(true);
  expect(v.reason).toContain("locked");
});

test("the Stop hook holds the builder until the gate passed on the code as it is", () => {
  const dir = project();
  const stop = realStop();
  const env = { FACTORY_STAGE: "build" };
  const first = runHook(stopGate, stop, dir, env);
  expect(first.json?.decision).toBe("block");
  expect(runHook(stopGate, { ...stop, stop_hook_active: true }, dir, env).blocked).toBe(false);
  expect(runHook(stopGate, stop, dir, { FACTORY_STAGE: "review" }).blocked).toBe(false);
  expect(sh(["bun", "run", "gate"], { cwd: dir }).code).toBe(0);
  expect(runHook(stopGate, stop, dir, env).blocked).toBe(false);
  writeFileSync(
    join(dir, "src/fees/split.ts"),
    `${readFileSync(join(dir, "src/fees/split.ts"), "utf8")}\n// changed after the gate\n`,
  );
  expect(runHook(stopGate, stop, dir, env).reason).toContain("changed after the last gate run");
}, 30000);

test("the Stop hook and the gate hash the same tree", async () => {
  const dir = project();
  sh(["bun", "run", "gate"], { cwd: dir });
  expect(JSON.parse(readFileSync(join(dir, ".factory/gate.json"), "utf8")).tree).toBe(
    treeHash(dir),
  );
}, 30000);

test("permission rules: deny wins, the grammar matches prefixes, and src/auth/ is denied", () => {
  expect(
    decide(settings, { tool: "Bash", input: { command: "git push --force origin main" } }),
  ).toBe("deny");
  expect(
    decide(settings, { tool: "Bash", input: { command: "git commit -m x --no-verify" } }),
  ).toBe("deny");
  expect(decide(settings, { tool: "Read", input: { file_path: ".env.local" } })).toBe("deny");
  expect(decide(settings, { tool: "Edit", input: { file_path: "src/auth/roles.ts" } })).toBe(
    "deny",
  );
  expect(decide(settings, { tool: "Bash", input: { command: "bun test tests/fees" } })).toBe(
    "allow",
  );
  expect(
    decide(
      { permissions: { allow: ["Bash"], deny: ["Bash(rm:*)"] } },
      { tool: "Bash", input: { command: "rm x" } },
    ),
  ).toBe("deny");
});

test("frontmatter and sections read what a learner writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "fm-"));
  writeFileSync(
    join(dir, "SKILL.md"),
    "---\nname: triage\nallowed-tools: Read, Grep\n---\n# Triage\n\n## Reply\n\nTYPE:\n",
  );
  expect(frontmatter(join(dir, "SKILL.md"))?.data.name).toBe("triage");
  expect(sections("# A\n\n## Outcome\n\nx\n## Done when\n- y").get("done when")).toBe("- y");
  expect(
    requirementLines(
      "## Requirements\n\n- R1. When a, the system shall b.\n- R2: If c, the system shall d.",
    ),
  ).toHaveLength(2);
});

const replay = (n: number, run: string) => {
  const out = join(mkdtempSync(join(tmpdir(), "finished-")), "run");
  const r = sh([
    "bun",
    join(ROOT, "world/finished/run.ts"),
    String(n),
    "--replay",
    "--run",
    run,
    "--out",
    out,
  ]);
  const parsed = parseResult(JSON.parse(readFileSync(join(out, "result.json"), "utf8")));
  if (!parsed.ok) throw new Error(parsed.why);
  return { stdout: r.stdout, result: parsed.result };
};

// Behaviour that varies run to run is judged over the 3 recorded runs: each must reach a draft PR with the
// gate green, no test edited in the build, and the review passing.
for (const run of ["run-1", "run-2", "run-3"]) {
  test(`the recorded ${run} of issue 2 replays to a draft PR with the gate green`, () => {
    const { stdout, result } = replay(2, run);
    expect(stdout).toContain("ended in draft_pr");
    expect(stdout).toContain("every verdict matches");
    expect(result.replayed).toBe(true);
    expect(result.gate?.exit_code).toBe(0);
    expect(result.tests_edited).toEqual([]);
    expect(result.review?.verdict).toBe("pass");
    expect(result.claude_runs?.map((c) => c.stage)).toEqual(["triage", "spec", "build", "review"]);
    expect(result.cost_usd).toBeGreaterThan(0);
  }, 60000);
}

test("the recorded run of issue 6 is refused at triage: it needs src/auth/", () => {
  const { result } = replay(6, "run-1");
  expect(result.state).toBe("refused");
  expect(result.claude_runs?.map((c) => c.stage)).toEqual(["triage"]);
}, 30000);
