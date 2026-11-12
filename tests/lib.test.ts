// Tests for checks/lib and the finished system. `bun test tests` runs them with no key.
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frontmatter, sections } from "../checks/lib/files";
import { decide } from "../checks/lib/permissions";
import { parseResult } from "../checks/lib/result";
import { hooksFor, runHook, sh } from "../checks/lib/run";
import { requirementLines } from "../checks/lib/spec";
import { appFiles, issue, issues, ROOT } from "../checks/lib/world";

const settings = JSON.parse(readFileSync(join(ROOT, "world/finished/settings.json"), "utf8"));
const lockTests = hooksFor(settings, "PreToolUse", "Edit")[0];
const edit = (file_path: string) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path } });

test("the backlog has seven issues and issue 6 names the protected path", () => {
  expect(issues().map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(issue(6).body).toContain("src/auth/");
  expect(appFiles()).toContain("src/fees/split.ts");
});

test("the test-lock hook blocks a test edit in build and allows it in spec", () => {
  expect(runHook(lockTests, edit("tests/fees/split.test.ts"), ROOT, { FACTORY_STAGE: "build" }).blocked).toBe(true);
  expect(runHook(lockTests, edit("tests/fees/split.test.ts"), ROOT, { FACTORY_STAGE: "spec" }).blocked).toBe(false);
  expect(runHook(lockTests, edit("src/fees/split.ts"), ROOT, { FACTORY_STAGE: "build" }).blocked).toBe(false);
});

test("the test-lock hook blocks the planted bad command: sed on a test file", () => {
  const ev = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "sed -i 's/1667/1666/' tests/fees/split.test.ts" } };
  const v = runHook(hooksFor(settings, "PreToolUse", "Bash")[0], ev, ROOT, { FACTORY_STAGE: "build" });
  expect(v.blocked).toBe(true);
  expect(v.reason).toContain("locked");
});

test("permission rules: deny wins and the grammar matches prefixes", () => {
  expect(decide(settings, { tool: "Bash", input: { command: "git push --force origin main" } })).toBe("deny");
  expect(decide(settings, { tool: "Bash", input: { command: "git commit -m x --no-verify" } })).toBe("deny");
  expect(decide(settings, { tool: "Read", input: { file_path: ".env.local" } })).toBe("deny");
  expect(decide(settings, { tool: "Bash", input: { command: "bun test" } })).toBe("none");
  expect(decide({ permissions: { allow: ["Bash"], deny: ["Bash(rm:*)"] } }, { tool: "Bash", input: { command: "rm x" } })).toBe("deny");
});

test("frontmatter and sections read what a learner writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "fm-"));
  writeFileSync(join(dir, "SKILL.md"), "---\nname: triage\nallowed-tools: Read, Grep\n---\n# Triage\n\n## Reply\n\nTYPE:\n");
  expect(frontmatter(join(dir, "SKILL.md"))?.data.name).toBe("triage");
  expect(sections("# A\n\n## Outcome\n\nx\n## Done when\n- y").get("done when")).toBe("- y");
  expect(requirementLines("## Requirements\n\n- R1. When a, the system shall b.\n- R2: If c, the system shall d.")).toHaveLength(2);
});

test("the replay of issue 2 ends in a draft PR with one blocked edit", () => {
  const out = join(mkdtempSync(join(tmpdir(), "replay-")), "run");
  const r = sh(["bun", join(ROOT, "world/finished/replay.ts"), "2", "--out", out]);
  expect(r.stdout).toContain("ended in draft_pr");
  const parsed = parseResult(JSON.parse(readFileSync(join(out, "result.json"), "utf8")));
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.result.blocked_by_hooks).toHaveLength(1);
    expect(parsed.result.tests_edited).toEqual([]);
    expect(parsed.result.gate?.exit_code).toBe(0);
  }
}, 30000);

test("the Stop hook blocks with no gate record and lets go once the gate passed", () => {
  const stop = hooksFor(settings, "Stop")[0];
  const runDir = mkdtempSync(join(tmpdir(), "stop-"));
  const env = { FACTORY_RUN_DIR: runDir, FACTORY_APP_DIR: join(ROOT, "world/app") };
  expect(runHook(stop, { hook_event_name: "Stop", stop_hook_active: false }, ROOT, env).blocked).toBe(true);
  expect(runHook(stop, { hook_event_name: "Stop", stop_hook_active: true }, ROOT, env).blocked).toBe(false);
  sh(["bun", join(ROOT, "world/gate.ts"), join(ROOT, "world/app"), "--record", join(runDir, "gate.json")]);
  expect(runHook(stop, { hook_event_name: "Stop", stop_hook_active: false }, ROOT, env).blocked).toBe(false);
}, 30000);
