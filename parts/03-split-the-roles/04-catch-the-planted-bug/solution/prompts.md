# How Claude Code got here: catch the planted bug

The reviewer from `build-the-reviewer` blocks the planted bug in all three runs, with a date pair. It passes
the clean fix in all three. The six transcripts in this folder are those runs.

Run the reviews from this step's `problem/` folder:

```bash
mkdir -p runs/review-planted runs/review-clean && for run in 1 2 3; do for diff in planted clean; do file=issue-3-clean.diff; [ $diff = planted ] && file=issue-3-offbyone.diff; claude -p "Review the change in diffs/$file for issue 3." --agent reviewer --add-dir ../../../../world --output-format stream-json --verbose --setting-sources project,local --no-session-persistence > runs/review-$diff/run-$run.jsonl; done; done
```

Expect: no output, and three files in each `runs/` folder.

## What the reviewer said

Run 3 on the planted diff replied:

```json
{
  "verdict": "block",
  "findings": [
    {
      "file": "src/loans/reserve.ts",
      "line": 10,
      "evidence": "The fix is asymmetric: `first.from < second.to && second.from <= first.to`. `overlaps({from:'2026-03-13',to:'2026-03-15'}, {from:'2026-03-01',to:'2026-03-13'})` returns false, because `'03-13' < '03-13'` is false. With the arguments the other way round, the same two ranges return true. The code's own comment says two ranges clash when they share any date, and the issue says the due date is taken. Both orders should return true. This shows up in `clashes`. An existing reservation 2026-03-13..2026-03-15 and a wanted booking 2026-03-01..2026-03-13 share the 13th, but `overlaps(booking, wanted)` returns false. The clash is missed and the item is double-booked on that date. A correct check would use `<=` on both comparisons."
    }
  ]
}
```

## What you check

- The file is `src/loans/reserve.ts` and the line is inside the changed hunk.
- The evidence is an input. For example, you can write it as a test: a booking from 2026-03-13 to
  2026-03-15 and one from 2026-03-01 to 2026-03-13 must clash.
- All three clean runs replied with a pass verdict and no findings.

## When the reviewer misses it

The `wrong/trusts-the-tests/` answer is a real run of a weak reviewer. Its prompt only says "pass a change
that adds a fitting test". It blocked the bug in two runs and passed it in one. Its pass, run 1, said:

```json
{
  "verdict": "pass",
  "findings": [
    {
      "file": "tests/loans/reserve.test.ts",
      "line": 25,
      "evidence": "The new test 'a booking that starts on the due date clashes' uses an existing loan ending 2026-03-13 and a new booking starting 2026-03-13, and expects a clash. This is the case in issue 3 (drill-01 due on the 13th, bookable from the 13th). It fails on the old `second.from < first.to` and passes on the new `<=`."
    },
    {
      "file": "tests/loans/reserve.test.ts",
      "line": 31,
      "evidence": "A second test covers the boundary from the other side. A booking starting 2026-03-14, the day after the due date, does not clash, so the fix does not over-block."
    },
    {
      "file": "src/loans/reserve.ts",
      "line": 10,
      "evidence": "Note, not a blocker: the fix is asymmetric. `first.from < second.to` is still strict, so `overlaps(a, b)` and `overlaps(b, a)` can differ when one booking ends on the day the other starts. The tests only cover the case in the issue. I could not read src/loans/reserve.ts in the working tree to check which argument `clashes` passes as `wanted`, so I did not verify that."
    }
  ]
}
```

That reviewer caught the bug by luck, not by its prompt. If yours misses it, open `claude` in this folder
and type:

```text
In .claude/agents/reviewer.md, add to the steps: for every date range in the change, try both orders of the arguments and the first and last day of each range. Block only with evidence: the two date ranges that break the code, and what the code returns for them. Show me the change before you make it.
```

Then run the six reviews again.

## What you reject

- A reviewer that trusts the tests. The `wrong/trusts-the-tests/` answer shows it.
- A reviewer that may edit. It fixes the bug instead of reporting it. The `wrong/reviewer-can-edit/` answer
  shows it.

```bash
bun run verify catch-the-planted-bug solution
```

Expect: `Done. All 7 rules pass.`
