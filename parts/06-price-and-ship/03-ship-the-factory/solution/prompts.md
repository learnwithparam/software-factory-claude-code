# How Claude Code got here: ship the factory

You run the factory on all seven issues. Then Claude Code reads the runs with you and writes the retro. The
runs in `runs/` are real live runs made with Claude Code 2.1.323, and `notes/retro.md` is what Claude Code
wrote from them.

## Run the whole backlog

In this step's `problem/` folder:

```bash
for issue in 1 2 3 4 5 6 7; do bun run factory $issue --json > /dev/null; done
```

Expect: seven last lines. Issues 1 to 5 end `draft_pr`, issue 6 ends `refused`, issue 7 ends `stopped_at_plan`.

Run them one at a time. In the real run, all seven were started at once first, and the machine stopped three
of them half way. Issues 2, 4 and 5 ran again one after another. A run that is stopped writes no
`result.json`, so it is easy to spot.

The real results: issues 1 to 5 reached `draft_pr` with the gate green in round 1 and the review passing.
Issues 2, 4 and 5 ran the plan stage. Issue 5 is labelled only `feature`, but the live triage called the
chainsaw rule high risk. Issue 6 was refused and issue 7 stopped at the plan. The seven runs cost $1.53.

## Prompt 1: read the runs and write the retro

Start Claude Code in the same folder:

```bash
claude
```

Expect: Claude Code opens and waits for your prompt.

```text
Read runs/*/result.json and the console lines in runs/*/console.txt. Make a table: issue, state, roles by stage, gate rounds, review verdict, cost. Then fill in notes/retro.md under its three headings: a gate that fired (a real one, from the runs), what it cost (the total and the most expensive stage, in dollars), and what I change next. Use only numbers from the runs.
```

## What Claude Code reported

```text
I've filled in `notes/retro.md` under its three headings. I didn't run `bun run readable` because it needed an approval this session doesn't have, and I only changed the retro, not any code.

| Issue | State | Roles by stage | Gate rounds | Review | Cost |
|---|---|---|---|---|---|
| 1 | draft_pr | triage fast, spec smart, build smart, review judge | 1 | pass | $0.26 |
| 2 | draft_pr | triage fast, spec smart, plan smart, build smart, review judge | 1 | pass | $0.27 |
| 3 | draft_pr | triage fast, spec smart, build smart, review judge | 1 | pass | $0.27 |
| 4 | draft_pr | triage fast, spec smart, plan smart, build smart, review judge | 1 | pass | $0.41 |
| 5 | draft_pr | triage fast, spec smart, plan smart, build smart, review judge | 1 | pass | $0.31 |
| 6 | refused | triage fast | - | - | $0.003 |
| 7 | stopped_at_plan | triage fast | - | - | $0.004 |

**The plan stage never wrote a plan.** On issues 2, 4 and 5, the planner's write to `specs/<issue>/PLAN.md` was denied, even though the plan stage allows `Write(specs/**)`. Each planner said in its transcript that it couldn't write the file and printed the plan as text. The console still logged `plan: success` each time and the run went on to build. So no high-risk issue got a `PLAN.md`, and those 3 plan calls cost $0.27. The runner doesn't check that the file exists, so `result.json` and the console both look fine.

**A gate that fired:** `bun run gate` passed on round 1 in all five builds, and no hook blocked anything (`blocked_by_hooks` is empty everywhere). The gate that actually stopped calls was the permission gate, 5 times in all:
- **Issue 5, spec:** a `grep` reaching outside the copy (`../../seed`) was denied. That's the gate working as intended.
- **Issue 3, spec:** an attempt to add a test with a shell `cat >>` was denied, and the agent made the change with `Edit` instead.
- **Issues 2, 4, 5, plan:** the denied plan writes above, where the gate blocked the stage's own job.

**What it cost:** $1.53 in total across 25 `claude -p` calls, against the $10 cap. Spec was the most expensive stage at $0.58 across the five runs (38% of the total). It was also the most expensive single call: $0.15 for issue 4's spec.

**What I change next:**
1. Fix the plan stage's write rule and test it until the planner can write `PLAN.md` but nothing else.
2. Have `run.ts` end the run when a stage doesn't produce its file.
3. Fix the warning printed on every call: "Ignoring 5 permissions.allow entries … workspace has not been trusted".
4. Cut the spec stage's cost by having it read only the files triage named and lowering its turn limit from 30 (it never used more than 13).

All numbers in the retro come from the run files. The per-stage totals are sums of `claude_runs[].cost_usd` in each `result.json`.
```

## What you check in the retro

- Every number matches a result file. Add up `cost_usd` yourself: $1.53. Spec is the biggest stage, $0.58.
- The finding is real. Open `runs/2/transcripts/plan.jsonl`: the planner's `Write` to `specs/2/PLAN.md`
  was denied, with "Permission to use Write has been denied because Claude Code is running in don't ask
  mode". The plan stage from `route-models-by-stage` allows `Write(specs/**)`, but that rule did not match.
  The runner still logged `plan: success`. No check in this course caught it. Only reading the runs did.
- That is why the retro matters more than a green scorecard. "What I change next" names the fix: make the
  planner's write rule match, and end the run when a stage does not write its file.

## What you reject

- A retro left empty. The `wrong/retro-left-empty/` answer has every run, and no retro.
- Dry runs in place of live runs. The `wrong/dry-runs-only/` answer has seven dry runs. They cost nothing,
  call no model, and prove nothing about the factory.

```bash
bun run verify ship-the-factory solution
```

Expect: `Done. All 7 rules pass.`
