// run-two-at-once (elective): two live runs, issues 3 and 5, side by side.
// Each run has its own copy of the app and its own branch, and no file is changed by both.
// The check reads the result files and the transcripts the runs saved: no model and no key.

import { filesChangedInRun, liveRun } from "../parts/05-run-it-unattended/factory-checks";
import type { Rule } from "../scripts/verify";

const ISSUES = [3, 5];

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
] satisfies Rule[];
