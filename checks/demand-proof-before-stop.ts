// demand-proof-before-stop: a Stop hook keeps the builder working
// until the gate passed on the code as it is now.
// The hook runs in a throwaway factory project: the app, the learner's .claude/ and the gate at
// .factory/gate.ts. `bun run gate --record .factory/gate.json` writes { exit_code, tree }, where
// tree is a hash of src/ and tests/. Each case writes that record, or leaves it out, and runs the
// hook on the real Stop event Claude Code sent in a recorded run.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { treeHash } from "../world/gate";
import { json } from "./lib/files";
import { hooksFor, runHook } from "./lib/run";
import { ranCommand, readSession } from "./lib/session";
import { APP, ROOT, WORLD } from "./lib/world";

const RECORDED_BUILD = join(
  ROOT,
  "world",
  "recordings",
  "issue-2",
  "run-1",
  "hooks",
  "build.jsonl",
);
const OLD_TREE = "0123456789ab";

type GateRecord = { exitCode: number; tree: "now" | "old" } | null;
type Case = { record: GateRecord; stage: string; alreadyContinued: boolean };

function realStopEvent(): Record<string, unknown> {
  const lines = readFileSync(RECORDED_BUILD, "utf8").split("\n").filter(Boolean);
  const events = lines.map((line) => JSON.parse(line));
  return events.find((event) => event.hook_event_name === "Stop");
}

function stopHooks(folder: string): string[] {
  return hooksFor(json(join(folder, ".claude", "settings.json")), "Stop");
}

// A factory project as the finished factory lays it out, with the learner's .claude/ in it.
function factoryProject(folder: string): string {
  const project = join(mkdtempSync(join(tmpdir(), "stop-gate-")), "project");
  for (const part of ["src", "tests", "seed"]) {
    cpSync(join(APP, part), join(project, part), { recursive: true });
  }
  if (existsSync(join(folder, ".claude"))) {
    cpSync(join(folder, ".claude"), join(project, ".claude"), { recursive: true });
  }
  mkdirSync(join(project, ".factory"), { recursive: true });
  cpSync(join(WORLD, "gate.ts"), join(project, ".factory", "gate.ts"));
  return project;
}

function writeGateRecord(project: string, record: NonNullable<GateRecord>): void {
  const tree = record.tree === "now" ? treeHash(project) : OLD_TREE;
  // biome-ignore lint/style/useNamingConvention: world/gate.ts writes exit_code in snake_case.
  const gate = { command: "bun run gate", exit_code: record.exitCode, tree };
  writeFileSync(join(project, ".factory", "gate.json"), `${JSON.stringify(gate, null, 2)}\n`);
}

// True when a Stop hook keeps Claude Code working in this case.
function keepsWorking(folder: string, stopCase: Case): boolean {
  const commands = stopHooks(folder);
  if (commands.length === 0) return false;
  const project = factoryProject(folder);
  if (stopCase.record) writeGateRecord(project, stopCase.record);
  // biome-ignore lint/style/useNamingConvention: Claude Code names these event keys.
  const event = { ...realStopEvent(), cwd: project, stop_hook_active: stopCase.alreadyContinued };
  // biome-ignore lint/style/useNamingConvention: the factory names its stage variable this way.
  const environment = { FACTORY_STAGE: stopCase.stage };
  const verdicts = commands.map((command) => runHook(command, event, project, environment));
  return verdicts.some((verdict) => verdict.blocked && verdict.reason.trim().length > 0);
}

const inBuild = (record: GateRecord): Case => ({ record, stage: "build", alreadyContinued: false });

export default [
  {
    says: "settings.json registers a Stop command hook",
    test: (folder) => stopHooks(folder).length > 0,
    tryNext: "ask Claude Code to register the hook under hooks.Stop in .claude/settings.json",
  },
  {
    says: "in the build stage, with no gate record, the hook blocks the stop and says why",
    test: (folder) => keepsWorking(folder, inBuild(null)),
    tryNext:
      'ask Claude Code to print {"decision":"block","reason":"Run bun run gate first."} ' +
      "when .factory/gate.json is missing",
  },
  {
    says: "with a passing record for an older version of the code, it blocks",
    test: (folder) => keepsWorking(folder, inBuild({ exitCode: 0, tree: "old" })),
    tryNext:
      "ask Claude Code to hash src/ and tests/ the way world/gate.ts does " +
      "and block when the hash differs from the tree in gate.json",
  },
  {
    says: "with a record of a failed gate on the code as it is, it blocks",
    test: (folder) => keepsWorking(folder, inBuild({ exitCode: 1, tree: "now" })),
    tryNext: "ask Claude Code to block when exit_code in gate.json is not 0",
  },
  {
    says: "with a fresh passing record, it lets Claude Code stop",
    test: (folder) =>
      stopHooks(folder).length > 0 && !keepsWorking(folder, inBuild({ exitCode: 0, tree: "now" })),
    tryNext:
      "ask Claude Code to allow the stop when exit_code is 0 and the tree matches the code now",
  },
  {
    says: "when stop_hook_active is true, it lets Claude Code stop, so it can never loop",
    test: (folder) =>
      stopHooks(folder).length > 0 &&
      !keepsWorking(folder, { record: null, stage: "build", alreadyContinued: true }),
    tryNext:
      "ask Claude Code to read stop_hook_active from the event and allow the stop when it is true",
  },
  {
    says: "outside the build stage, it lets Claude Code stop",
    test: (folder) =>
      stopHooks(folder).length > 0 &&
      !keepsWorking(folder, { record: null, stage: "review", alreadyContinued: false }),
    tryNext: "ask Claude Code to check only when FACTORY_STAGE is build",
  },
  {
    says: "your saved session shows you set a goal with /goal",
    test: (folder) => ranCommand(readSession(folder), "goal"),
    tryNext: "type /goal with a stop condition, such as bun run gate passes, then save the session",
  },
] satisfies Rule[];
