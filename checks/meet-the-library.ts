// meet-the-library: the machine is ready, the finished factory was replayed, and the learner named the issue
// they expect it to get wrong, with a reason. Reads files and runs the doctor; never reads a chat.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json, nonEmptyLines, read } from "./lib/files";
import { parseResult } from "./lib/result";
import { sh } from "./lib/run";
import { ROOT } from "./lib/world";

// bun run finished 2 writes runs/finished-2/ at the repo root, live or replayed. A folder can also carry its
// own copy (the sample solution does).
const resultPath = (d: string) => [join(d, "runs", "finished-2", "result.json"), join(ROOT, "runs", "finished-2", "result.json")].find(existsSync);
const goalLines = (d: string) =>
  nonEmptyLines(read(join(d, "notes", "goal.md")) ?? "").filter((l) => !l.startsWith("<!--") && !l.startsWith("#"));
const ISSUE = /\b(?:issue\s*#?|#)([1-7])\b/i;

export default [
  {
    says: "bun run doctor passes its required checks",
    test: () => sh(["bun", join(ROOT, "scripts", "doctor.ts")]).code === 0,
    tryNext: "run bun run doctor and fix each FAIL line it prints, then run this check again",
  },
  {
    says: "the finished factory ran issue 2 and wrote runs/finished-2/result.json in the contract shape",
    test: (d) => {
      const p = resultPath(d);
      const r = p ? parseResult(json(p)) : null;
      return Boolean(r?.ok && r.result.issue === 2 && (r.result.claude_runs?.length ?? 0) > 0);
    },
    tryNext: "run bun run finished 2 from the repo root and read what each stage printed",
  },
  {
    says: "notes/goal.md has a line of your own",
    test: (d) => goalLines(d).length > 0,
    tryNext: "write one line in notes/goal.md inside this step's problem folder, below the comment",
  },
  {
    says: "the line names one issue from the backlog, 1 to 7",
    test: (d) => goalLines(d).some((l) => ISSUE.test(l)),
    tryNext: "name the issue by number, for example: Issue 3, because the due date looks like a free date",
  },
  {
    says: "the line says why, in at least eight words",
    test: (d) => goalLines(d).some((l) => ISSUE.test(l) && l.split(/\s+/).length >= 8),
    tryNext: "add the reason after the issue number: what about that issue would fool an agent working alone",
  },
] satisfies Rule[];
