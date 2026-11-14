// run-two-at-once (elective): two live runs, issues 3 and 5, side by side.
// Each run has its own copy of the app and its own branch, and no file is changed by both.
// The check reads the result files and the transcripts the runs saved: no model and no key.

import { join, resolve } from "node:path";
import { filesChangedInRun, liveRun } from "../parts/05-run-it-unattended/factory-checks";
import type { Rule } from "../scripts/verify";
import { read, sections } from "./lib/files";
import { runCommand } from "./lib/run";

const ISSUES = [3, 5];
const MARKERS = /^(<<<<<<<|=======|>>>>>>>)/m;

// When two runs do change the same lines, the second one must rebase and fix a conflict.
// The folder conflict/ holds a file a rebase left with markers. The learner resolves it.
function resolvedFile(folder: string): string | null {
  const text = read(join(folder, "conflict", "clash.ts"));
  return text && !MARKERS.test(text) ? text : null;
}

function conflictIsResolved(folder: string): boolean {
  return resolvedFile(folder) !== null;
}

// Both sides must survive: inclusive dates from run 3 and the no-start-date guard from run 5.
function bothChangesKept(folder: string): boolean {
  const path = resolve(folder, "conflict", "clash.ts");
  if (resolvedFile(folder) === null) return false;
  const probe = `
    const { overlaps } = await import(${JSON.stringify(path)});
    const day = (from: string, until: string) => ({ from, to: until });
    const touching = overlaps(day("2026-03-01", "2026-03-13"), day("2026-03-13", "2026-03-15"));
    const noStart = overlaps(day("", "2026-03-13"), day("2026-03-01", "2026-03-15"));
    const apart = overlaps(day("2026-03-01", "2026-03-05"), day("2026-03-07", "2026-03-09"));
    console.log(JSON.stringify({ touching, noStart, apart }));`;
  const ran = runCommand(["bun", "-e", probe]);
  try {
    const got = JSON.parse(ran.stdout.trim());
    return got.touching === true && got.noStart === false && got.apart === false;
  } catch {
    return false;
  }
}

function rebaseNotesAreWritten(folder: string): boolean {
  const notes = read(join(folder, "conflict", "NOTES.md")) ?? "";
  const found = sections(notes);
  const words = (heading: string) => (found.get(heading) ?? "").split(/\s+/).filter(Boolean).length;
  const reran = /gate|test/i.test(found.get("what i ran after the rebase") ?? "");
  return words("which file did both runs change?") >= 8 && words("how i resolved it") >= 8 && reran;
}

function bothRanLive(folder: string): boolean {
  return ISSUES.every((issue) => {
    const live = liveRun(folder, issue);
    return live.result !== null && live.costMatches && live.result.cost_usd > 0;
  });
}

function separateCopies(folder: string): boolean {
  const results = ISSUES.map((issue) => liveRun(folder, issue).result);
  const [first, second] = results;
  if (!first?.worktree || !second?.worktree) return false;
  const differentCopies = first.worktree !== second.worktree;
  return differentCopies && Boolean(first.branch) && first.branch !== second.branch;
}

function eachRunChangedFiles(folder: string): boolean {
  return ISSUES.every((issue) => filesChangedInRun(folder, issue).length > 0);
}

function noFileChangedByBoth(folder: string): boolean {
  const [firstFiles, secondFiles] = ISSUES.map((issue) => filesChangedInRun(folder, issue));
  const shared = firstFiles.filter((file) => secondFiles.includes(file));
  return firstFiles.length > 0 && secondFiles.length > 0 && shared.length === 0;
}

export default [
  {
    says: "issues 3 and 5 each have a live run whose cost matches its transcripts",
    test: bothRanLive,
    tryNext:
      "run bun run factory 3 --json and bun run factory 5 --json in two terminals, " +
      "without --dry-run, with Claude Code signed in",
  },
  {
    says: "the two runs worked in different copies of the app, on different branches",
    test: separateCopies,
    tryNext:
      "read worktree and branch in runs/3/result.json and runs/5/result.json; " +
      "ask Claude Code why two runs would share one",
  },
  {
    says: "each run's transcripts show Claude Code changing at least one file",
    test: eachRunChangedFiles,
    tryNext: "open runs/<issue>/console.txt and see which stage stopped before it changed a file",
  },
  {
    says: "no file was changed by both runs",
    test: noFileChangedByBoth,
    tryNext:
      "two issues that change the same file will conflict when both merge; " +
      "pick two ready issues whose files in factory/backlog.json do not overlap",
  },
  {
    says: "conflict/clash.ts has no conflict markers left",
    test: conflictIsResolved,
    tryNext:
      "open conflict/clash.ts, find the lines that start with <<<<<<<, =======, >>>>>>>, " +
      "and ask Claude Code to merge the two changes into one version",
  },
  {
    says: "the merged file keeps both runs' changes",
    test: bothChangesKept,
    tryNext:
      "run 3 made dates inclusive and run 5 skipped a range with no start date; " +
      "the merged overlaps must do both, so do not pick one side",
  },
  {
    says: "conflict/NOTES.md names the file, the fix, and the gate run after the rebase",
    test: rebaseNotesAreWritten,
    tryNext:
      "write a few sentences under each of the three headings, and say you ran the gate again",
  },
] satisfies Rule[];
