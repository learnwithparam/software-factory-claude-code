// lock-the-tests: a PreToolUse hook blocks every change to a test file in the build stage,
// and tells Claude Code to change the code instead.
// The hook is run the way Claude Code runs it, on the exact events Claude Code sent the finished
// factory's hooks in a recorded run (world/recordings/issue-2/run-1/hooks/).
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json } from "./lib/files";
import { decide } from "./lib/permissions";
import { type HookVerdict, hooksFor, runHook } from "./lib/run";
import { ROOT } from "./lib/world";

// biome-ignore-start lint/style/useNamingConvention: Claude Code names these event keys.
type HookEvent = Record<string, unknown> & {
  tool_name?: string;
  tool_input?: { file_path?: string; command?: string };
};
// biome-ignore-end lint/style/useNamingConvention: the event keys end here.

const RECORDED_HOOKS = join(ROOT, "world", "recordings", "issue-2", "run-1", "hooks");
const PLANTED_COMMAND = "sed -i 's/1667/1666/' tests/fees/split.test.ts";

function recordedEvents(stage: string): HookEvent[] {
  const lines = readFileSync(join(RECORDED_HOOKS, `${stage}.jsonl`), "utf8").split("\n");
  return lines.filter(Boolean).map((line) => JSON.parse(line));
}

function findEvent(stage: string, tool: string, target: RegExp): HookEvent {
  const found = recordedEvents(stage).find((event) => {
    const input = event.tool_input ?? {};
    return event.tool_name === tool && target.test(input.file_path ?? input.command ?? "");
  });
  if (!found) throw new Error(`no recorded ${tool} event for ${target} in ${stage}`);
  return found;
}

const testEdit = () => findEvent("spec", "Edit", /tests\/fees\/split\.test\.ts$/);
const codeEdit = () => findEvent("build", "Edit", /src\/fees\/split\.ts$/);
const gateRun = () => findEvent("build", "Bash", /^bun run gate$/);

// The real Bash event from the build, with the command an agent uses to fake a pass.
function plantedShellWrite(): HookEvent {
  const real = gateRun();
  // biome-ignore lint/style/useNamingConvention: Claude Code names this key.
  return { ...real, tool_input: { ...real.tool_input, command: PLANTED_COMMAND } };
}

function settings(folder: string): unknown {
  return json(join(folder, ".claude", "settings.json"));
}

// Run every PreToolUse hook the settings register for this tool, in a throwaway copy of the folder,
// so a hook that writes a log never changes the learner's work.
function runHooks(folder: string, event: HookEvent, stage: string): HookVerdict[] {
  const copy = join(mkdtempSync(join(tmpdir(), "lock-tests-")), "project");
  cpSync(folder, copy, { recursive: true });
  const commands = hooksFor(settings(folder), "PreToolUse", String(event.tool_name));
  // biome-ignore lint/style/useNamingConvention: the factory names its stage variable this way.
  const environment = { FACTORY_STAGE: stage };
  return commands.map((command) => runHook(command, event, copy, environment));
}

function isBlocked(folder: string, event: HookEvent, stage: string): boolean {
  const verdicts = runHooks(folder, event, stage);
  return verdicts.length > 0 && verdicts.some((verdict) => verdict.blocked);
}

function blockReason(folder: string): string {
  const verdicts = runHooks(folder, testEdit(), "build");
  return verdicts.find((verdict) => verdict.blocked)?.reason ?? "";
}

export default [
  {
    says: "settings.json registers a PreToolUse command hook for Edit, Write and Bash",
    test: (folder) =>
      ["Edit", "Write", "Bash"].every(
        (tool) => hooksFor(settings(folder), "PreToolUse", tool).length > 0,
      ),
    tryNext:
      "ask Claude Code to register the hook under hooks.PreToolUse, matcher Edit|Write|Bash; " +
      "a shell command can change a test too",
  },
  {
    says: "in the build stage, the recorded Edit of tests/fees/split.test.ts is blocked",
    test: (folder) => isBlocked(folder, testEdit(), "build"),
    tryNext:
      "the hook must exit 2 or print permissionDecision deny; exit 1 is only an error " +
      "and the edit still goes through",
  },
  {
    says: "the block reason tells Claude Code to change the code instead",
    test: (folder) => /src\/|the code/i.test(blockReason(folder)),
    tryNext:
      "ask Claude Code to print a reason on stderr that says: change the code under src/, " +
      "not the test",
  },
  {
    says: `in the build stage, a shell write to a test file is blocked: ${PLANTED_COMMAND}`,
    test: (folder) => isBlocked(folder, plantedShellWrite(), "build"),
    tryNext:
      "ask Claude Code to make the hook read Bash commands too, and block sed -i, a > redirect, " +
      "mv, cp or rm aimed at a test file",
  },
  {
    says: "in the spec stage, the same test edit is allowed: the spec writes the tests",
    test: (folder) => !isBlocked(folder, testEdit(), "spec"),
    tryNext: "ask Claude Code to block only when the FACTORY_STAGE variable is build",
  },
  {
    says: "in the build stage, editing src/fees/split.ts and running bun run gate are allowed",
    test: (folder) =>
      !isBlocked(folder, codeEdit(), "build") && !isBlocked(folder, gateRun(), "build"),
    tryNext: "ask Claude Code to block only test files, never a file under src/ or the gate itself",
  },
  {
    says: "the deny rules from deny-the-shortcuts are still there",
    test: (folder) => {
      const call = { tool: "Bash", input: { command: "git push origin main -f" } };
      return decide(settings(folder), call, folder) === "deny";
    },
    tryNext:
      "ask Claude Code to add the hooks next to permissions, and keep the deny list as it is",
  },
] satisfies Rule[];
