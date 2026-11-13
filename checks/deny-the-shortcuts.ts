// deny-the-shortcuts: deny rules in .claude/settings.json refuse the shortcuts
// before the tool runs, and still let everyday work through.
// Each call below is a tool call as Claude Code makes it; checks/lib/permissions.ts
// decides it with the same order Claude Code uses: deny, then ask, then allow.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json } from "./lib/files";
import { type Call, decide } from "./lib/permissions";

const bash = (command: string): Call => ({ tool: "Bash", input: { command } });
// biome-ignore lint/style/useNamingConvention: Claude Code names this field file_path.
const readFile = (path: string): Call => ({ tool: "Read", input: { file_path: path } });

const FORCE_PUSHES = [bash("git push --force origin main"), bash("git push origin main -f")];
const SKIPPED_HOOKS = [
  bash('git commit --no-verify -m "wip"'),
  bash("git push --no-verify origin factory/issue-2"),
];
const SECRET_READS = [readFile("./.env"), readFile("./.env.local")];
const EVERYDAY_CALLS = [
  bash("bun test tests/fees"),
  bash("bun run gate"),
  bash("git diff main"),
  bash('git commit -m "Fix the split rounding"'),
  readFile("./src/fees/split.ts"),
];

function settings(folder: string): unknown {
  return json(join(folder, ".claude", "settings.json"));
}

function allDenied(folder: string, calls: Call[]): boolean {
  const folderSettings = settings(folder);
  return calls.every((call) => decide(folderSettings, call, folder) === "deny");
}

function denyRules(folder: string): unknown {
  return (settings(folder) as { permissions?: { deny?: unknown } } | null)?.permissions?.deny;
}

export default [
  {
    says: ".claude/settings.json parses and has a permissions.deny list",
    test: (folder) => Array.isArray(denyRules(folder)) && (denyRules(folder) as []).length > 0,
    tryNext: "ask Claude Code to add a deny list under permissions in .claude/settings.json",
  },
  {
    says: "a force push is denied, written as --force and as -f",
    test: (folder) => allDenied(folder, FORCE_PUSHES),
    tryNext:
      "ask Claude Code for deny rules that catch both git push --force and git push ... -f; " +
      "a rule in ask only asks, it does not refuse",
  },
  {
    says: "--no-verify is denied on git commit and on git push",
    test: (folder) => allDenied(folder, SKIPPED_HOOKS),
    tryNext: "ask Claude Code for one deny rule that matches --no-verify anywhere in a command",
  },
  {
    says: "reading .env and .env.local is denied",
    test: (folder) => allDenied(folder, SECRET_READS),
    tryNext: "ask Claude Code for a Read deny rule on ./.env* so every .env file is covered",
  },
  {
    says: "everyday work is not denied: bun test, bun run gate, git diff, git commit, Read src/",
    test: (folder) => {
      const folderSettings = settings(folder);
      if (folderSettings === null) return false;
      return EVERYDAY_CALLS.every((call) => decide(folderSettings, call, folder) !== "deny");
    },
    tryNext:
      "a deny rule like Bash(*) or Bash(git *) also stops the builder's own work; " +
      "ask Claude Code to deny only the shortcuts",
  },
] satisfies Rule[];
