// meet-the-library: the machine is ready, the finished factory was replayed,
// and the learner named the issue they expect it to get wrong, with a reason.
// Reads files and runs the doctor; never reads a chat.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json, nonEmptyLines, read } from "./lib/files";
import { parseResult } from "./lib/result";
import { runCommand } from "./lib/run";
import { ROOT } from "./lib/world";

// bun run finished 2 writes runs/finished-2/ at the repo root, live or replayed.
// A folder can also carry its own copy (the sample solution does).
function resultPath(folder: string): string | undefined {
  const places = [
    join(folder, "runs", "finished-2", "result.json"),
    join(ROOT, "runs", "finished-2", "result.json"),
  ];
  return places.find(existsSync);
}

// The learner's own lines in notes/goal.md, without the comment and heading the starter gives them.
function goalLines(folder: string): string[] {
  const lines = nonEmptyLines(read(join(folder, "notes", "goal.md")) ?? "");
  return lines.filter((line) => !line.startsWith("<!--") && !line.startsWith("#"));
}

const ISSUE = /\b(?:issue\s*#?|#)([1-7])\b/i;

export default [
  {
    says: "bun run doctor passes its required checks",
    test: () => runCommand(["bun", join(ROOT, "scripts", "doctor.ts")]).code === 0,
    tryNext:
      "run bun run doctor and follow the Try next line under each FAIL, then run this check again",
  },
  {
    says:
      "the finished factory ran issue 2 and wrote runs/finished-2/result.json " +
      "in the contract shape",
    test: (folder) => {
      const path = resultPath(folder);
      const parsed = path ? parseResult(json(path)) : null;
      if (!parsed?.ok) return false;
      const claudeRuns = parsed.result.claude_runs?.length ?? 0;
      return parsed.result.issue === 2 && claudeRuns > 0;
    },
    tryNext:
      "run bun run finished 2 again, wait for its last line, and read what each stage printed",
  },
  {
    says: "notes/goal.md has a line of your own",
    test: (folder) => goalLines(folder).length > 0,
    tryNext:
      "ask Claude Code to add your one line to notes/goal.md in this step's problem folder, " +
      "below the comment",
  },
  {
    says: "the line names one issue from the backlog, 1 to 7",
    test: (folder) => goalLines(folder).some((line) => ISSUE.test(line)),
    tryNext:
      "ask Claude Code to name the issue by number, for example: " +
      "Issue 3, because the due date looks like a free date",
  },
  {
    says: "the line says why, in at least eight words",
    test: (folder) =>
      goalLines(folder).some((line) => ISSUE.test(line) && line.split(/\s+/).length >= 8),
    tryNext:
      "ask Claude Code to add your reason after the issue number: " +
      "what about that issue would fool an agent working alone",
  },
] satisfies Rule[];
