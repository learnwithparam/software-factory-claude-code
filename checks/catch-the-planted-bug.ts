// catch-the-planted-bug: the reviewer blocks the off-by-one fix for issue 3 with a date pair
// as evidence, and passes the clean fix in the same runs. Judged over 3 real runs, pass on 2.
import {
  blockedInPlantedLines,
  caughtThePlantedBug,
  demandsEvidence,
  passed,
  ranAsReviewer,
  reviewerReadsOnly,
  reviewRuns,
} from "../parts/03-split-the-roles/reviews";
import { enoughRuns } from "../parts/03-split-the-roles/transcripts";
import type { Rule } from "../scripts/verify";

const RUNS_NEEDED = 3;
const PASSING_RUNS_NEEDED = 2;

function enoughRealRuns(folder: string, diff: "clean" | "planted"): boolean {
  const transcripts = reviewRuns(folder, diff);
  return transcripts.length >= RUNS_NEEDED && transcripts.every(ranAsReviewer);
}

// Run 1 on the planted diff is paired with run 1 on the clean diff, and so on.
function pairsThatGetBoth(folder: string): number {
  const planted = reviewRuns(folder, "planted");
  const clean = reviewRuns(folder, "clean");
  let count = 0;
  for (let i = 0; i < Math.min(planted.length, clean.length); i++) {
    if (caughtThePlantedBug(planted[i]) && passed(clean[i])) count++;
  }
  return count;
}

export default [
  {
    says: "reviewer.md still reads only",
    test: reviewerReadsOnly,
    tryNext: "ask Claude Code to set the reviewer's tools back to Read, Grep, Glob",
  },
  {
    says: "the prompt allows a block only with evidence: the input that breaks the code",
    test: demandsEvidence,
    tryNext:
      "a reviewer that only checks for a test passes the bug by luck; ask Claude Code to write: " +
      "block only with the exact input that breaks the code",
  },
  {
    says: `runs/review-planted/ holds ${RUNS_NEEDED} real runs made as the reviewer`,
    test: (folder) => enoughRealRuns(folder, "planted"),
    tryNext: "run the review command for diffs/issue-3-offbyone.diff in this step's README",
  },
  {
    says: `runs/review-clean/ holds ${RUNS_NEEDED} real runs made as the reviewer`,
    test: (folder) => enoughRealRuns(folder, "clean"),
    tryNext: "run the review command for diffs/issue-3-clean.diff in this step's README",
  },
  {
    says: `at least ${PASSING_RUNS_NEEDED} planted runs block in src/loans/reserve.ts`,
    test: (folder) =>
      enoughRuns(reviewRuns(folder, "planted"), PASSING_RUNS_NEEDED, blockedInPlantedLines),
    tryNext:
      "read the planted diff yourself: overlaps changed on one side only; tell Claude Code " +
      "to try each date range in both orders, at the edges",
  },
  {
    says: "the evidence of those findings names a date pair",
    test: (folder) =>
      enoughRuns(reviewRuns(folder, "planted"), PASSING_RUNS_NEEDED, caughtThePlantedBug),
    tryNext:
      "ask Claude Code to make the reviewer give the two date ranges that break the code, " +
      "such as a booking from 2026-03-13 and one that ends on 2026-03-13",
  },
  {
    says: `in at least ${PASSING_RUNS_NEEDED} runs it blocks the bug and passes the clean fix`,
    test: (folder) => pairsThatGetBoth(folder) >= PASSING_RUNS_NEEDED,
    tryNext:
      "a reviewer that blocks everything is no reviewer; read the clean run that blocked, " +
      "and tell Claude Code that a doubt is not a finding",
  },
] satisfies Rule[];
