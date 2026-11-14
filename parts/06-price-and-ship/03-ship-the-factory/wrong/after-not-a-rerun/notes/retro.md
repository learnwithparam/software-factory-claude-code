# Retro: the factory on the whole backlog

## A gate that fired

The permission gate (`--permission-mode dontAsk` with `--allowedTools`) fired 5 times across the
backlog. It was the only gate that stopped a tool call. `bun run gate` passed on round 1 in all five
builds, and no hook blocked anything: `blocked_by_hooks` is empty in every `result.json`, and every
hook in the transcripts exited 0.

- Issue 5, spec: the spec writer ran `grep -ri -B2 -A6 chainsaw seed ../../seed`. That reads
  outside the copy, and `Bash(grep ...)` is not in the allowed tools, so it was denied. This is the
  gate working as intended.
- Issue 3, spec: the spec writer tried to add a test with `cat >> tests/loans/reserve.test.ts
  <<'EOF'`. That was denied, and it made the same change with `Edit`. The gate pushed it onto the
  tool the hooks can see.
- Issues 2, 4 and 5, plan: the planner's `Write` to `specs/<issue>/PLAN.md` was denied every time,
  even though the stage allows `Write(specs/**)`. The planner wrote "I couldn't write
  `specs/<issue>/PLAN.md`" and printed the plan as text instead. Each run still logged
  `plan: success` and went on to build. So the gate fired on the work the stage exists to do, and
  the runner didn't notice. No high-risk issue got a `PLAN.md` file.

## What it cost

All 7 runs cost **$1.53** in total ($1.529918), out of a `FACTORY_CAP_USD` of $10.
There were 25 `claude -p` calls.

| Issue | Total  |
| ----- | ------ |
| 4     | $0.41  |
| 5     | $0.31  |
| 2     | $0.27  |
| 3     | $0.27  |
| 1     | $0.26  |
| 7     | $0.004 |
| 6     | $0.003 |

The most expensive stage was **spec**. It cost $0.58 across the five runs that got that far, which
is 38% of the total. It was also the most expensive single call: issue 4's spec cost $0.15 over 13
turns. The other stages cost build $0.34, review $0.31, plan $0.27 and triage $0.03.

The plan stage spent $0.27 across issues 2, 4 and 5 and wrote no file. The two issues that stopped
at triage (6 refused, 7 stopped at plan) cost less than a cent together.

## What I change next

1. Fix the plan stage's write permission. `Write(specs/**)` did not let `specs/<issue>/PLAN.md`
   through on any of the 3 runs. I'll test the rule with a dry `claude -p` in a copy. A write
   to that path must be allowed, and a write elsewhere must still be denied.
2. Make `run.ts` check that the stage's output exists. After the plan stage, a missing
   `specs/<issue>/PLAN.md` should end the run, not log `success`. A stage counts as successful
   when it produces its file, not when `claude -p` exits cleanly.
3. Fix the warning on every call. All 25 calls printed "Ignoring 5 permissions.allow entries from
   .claude/settings.json: this workspace has not been trusted". Either the runner marks each fresh
   copy as trusted, or I drop those entries and let `--allowedTools` be the only allow list.
   Right now the settings file says one thing and the runs do another.
4. Make the spec stage cheaper. It is the biggest line item, at $0.58 of $1.53. I'll tighten its
   prompt so it reads only the files triage named, and lower its `--max-turns` from 30 toward the
   13 turns it actually needed at most.

## Before and after

I changed one setting: the spec stage's `--max-turns` went from 30 down to 14, and its prompt now says to read only the
files triage named. Before the change the seven runs cost **$1.53**. I ran the same seven issues again, saved in
`rerun/runs/`. After the change they cost **$1.68**. The cost went up, not down. The spec stage did get shorter, but
the builds and reviews cost more in this run, so one setting did not pay off. The review verdicts stayed the same on
all five drafts. Next I would rerun more than once, because one run is too small to tell a real change from noise.
