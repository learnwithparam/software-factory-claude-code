# How Claude Code got here: split the planner and the builder

Claude Code writes a planner that can only read and a builder that can change code. Then three real runs of
the planner plan issue 3. The agents and the three transcripts in this folder come from those runs.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Make two subagents in .claude/agents/. The first is planner.md. It plans one issue and changes nothing. Its tools are Read, Grep and Glob only: no Edit, no Write, no Bash. Set model: sonnet. It reads the issue in ../../../../world/backlog and the app in ../../../../world/app. It replies with a plan in two sections. Under ## Files, one app path per line, written from the app folder like src/loans/reserve.ts, with (new) after a file that does not exist yet. Under ## Steps, numbered steps. The second is builder.md. It carries out a plan. Its tools are Read, Grep, Glob, Edit, Write and Bash, with model: sonnet. It changes code under src/ until bun run gate passes, and it never edits src/auth/. Use short plain sentences. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code 2.1.323 in plan mode.

````text
Here's my plan. I haven't written either agent file yet. The only thing I've saved is this plan, at `/root/.claude/plans/make-two-subagents-in-warm-leaf.md`.

## What I'll create
- `.claude/agents/planner.md` (new)
- `.claude/agents/builder.md` (new)

Nothing else changes. I'll copy the style of `.claude/skills/triage/SKILL.md`: short plain sentences, numbered steps and a fixed reply shape.

## planner.md
```markdown
---
name: planner
description: Plans one backlog issue and changes nothing. Give it an issue number. It replies with a plan for the builder.
tools: Read, Grep, Glob
model: sonnet
---

# Plan one issue

You plan one issue. You only read. Do not change any file. Do not run commands.

## Steps

1. Find the issue. Glob `../../../../world/backlog/<number>-*.md`. Read it.
2. Find the code. Grep and Glob in `../../../../world/app/src` and `../../../../world/app/tests`.
   Read the likely files to confirm.
3. List every file the change needs. Write each path from the app folder, like `src/loans/reserve.ts`.
   Add `(new)` after a file that does not exist yet.
4. Never plan a change under `src/auth/`. If the issue needs one, say so in the steps and stop.
5. Write the steps a builder would follow. Keep each step short.

## Reply

Reply with these two sections only.

## Files
src/loans/reserve.ts
tests/loans/reserve.test.ts (new)

## Steps
1. First step.
2. Second step.
```

## builder.md
```markdown
---
name: builder
description: Carries out a plan from the planner. Changes code under src/ until bun run gate passes.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---

# Build one plan

You carry out one plan. The plan has a ## Files section and a ## Steps section.

## Rules

- Change code under `src/` only. Tests go under `tests/` when the plan lists them.
- Never edit anything in `src/auth/`. A coordinator reviews every change there.
  If the plan needs it, stop and say so.
- Every amount of money is in integer cents. Never use a float for money.

## Steps

1. Read the plan. Read each file it lists.
2. Follow the steps in order.
3. Run `bun test` while you work.
4. Run `bun run gate`. If it fails, fix the code and run it again.
5. Stop when `bun run gate` passes.

## Reply

Say what you changed and why. Give the last gate result.
```

## Decisions for you
- **Test files:** you asked for changes under `src/` only. My draft also lets the builder edit `tests/` when the plan lists a test file. Should it be `src/` only?
- **Money rule:** I added a line to the builder from `.claude/rules/money.md`: amounts are integer cents, never floats. Should it stay or go?

## How I'll check it
- I'll read both files back and check the tools and `model: sonnet` in each header.
- I'll confirm the planner has no Edit, Write or Bash.
- I can run the planner on issue 3 to check that it replies with the two sections.

These files don't touch app code, so `bun run gate` should give the same result as before.

Tell me to go ahead, or what to change, and I'll write the two files.
````

## What you check in the plan

- The planner has `tools: Read, Grep, Glob`. For example, if Claude Code had left the line out, the planner
  would get every tool, Edit and Bash too.
- Claude Code asks if the builder may edit `tests/`. Keep it for now. The "Gate the agent" part locks the tests with a hook,
  because a line in a prompt is only a request.
- The money rule in the builder repeats `.claude/rules/money.md`. It is short, so you can keep it.

## Prompt 2: approve

```text
Go ahead.
```

Claude Code asks before it writes under `.claude/`. Approve the writes. It said:

```text
I wrote the two subagents as planned. I couldn't run `bun run gate`, because the command needed approval and it wasn't approved.

- **`.claude/agents/planner.md`** has tools Read, Grep and Glob only, with `model: sonnet`. It reads the issue in `../../../../world/backlog` and the app in `../../../../world/app`. It replies with `## Files`, one path per line from the app folder with `(new)` after files that don't exist yet. Then it gives `## Steps`, numbered. It will not plan changes under `src/auth/`.
- **`.claude/agents/builder.md`** has tools Read, Grep, Glob, Edit, Write and Bash, with `model: sonnet`. It follows the plan and changes code under `src/` until `bun run gate` passes. It never edits `src/auth/`, and it stops and says so if the plan needs a change there.

As in the plan, I kept two extras. The builder may edit `tests/` when the plan lists a test file. It also has the integer-cents money rule.

These files don't touch app code, so the gate result should be the same as before. To finish the check, approve the gate when I ask again, or run it yourself from `/tmp/claude-0/wt/world/app`.
```

## The three planner runs

Type `/exit`, then run the planner three times from this folder:

```bash
mkdir -p runs/planner-3 && for run in 1 2 3; do claude -p "Plan issue 3." --agent planner --add-dir ../../../../world --output-format stream-json --verbose --setting-sources project,local --no-session-persistence > runs/planner-3/run-$run.jsonl; done
```

Expect: no output, and three files in `runs/planner-3/`.

Each run's first event lists the tools it had: only Read, Grep and Glob. All three plans named
`src/loans/reserve.ts`. The plan from run 3 was:

```text
Planning issue 3. I found the cause and have the plan ready.

## Files
src/loans/reserve.ts
tests/loans/reserve.test.ts

## Steps
1. In `src/loans/reserve.ts`, change `overlaps` to use inclusive comparisons: `first.from <= second.to && second.from <= first.to`. The current strict `<` lets a booking that starts on another booking's end date go through. That is the cause of the bug. The comment above the function already says ranges clash if they share any date, and `isOverdue` in `src/loans/dates.ts` already treats the due date as still the member's.
2. In `tests/loans/reserve.test.ts`, add a test. A range ending on `2026-03-13` and a range starting on `2026-03-13` must clash (`true`). This is the drill-01 / L-101 case.
3. Add a test that a range starting the day after the other ends does not clash. For example, `to: "2026-03-13"` and `from: "2026-03-14"` give `false`. This guards against making the check too wide.
4. Run `bun test`, then `bun run gate`.

`src/auth/` is not touched. `clashes` is only used inside `reserve.ts`, so nothing else needs to change.
```

## What you reject

- A planner with no `tools` line. The `wrong/no-tools-line/` answer shows it.
- A planner that may edit. The `wrong/planner-can-edit/` answer shows it.
- A planner with no `model`. Then you cannot choose what a plan costs. The `wrong/no-model/` answer shows it.

```bash
bun run verify split-planner-and-builder solution
```

Expect: `Done. All 8 rules pass.`
