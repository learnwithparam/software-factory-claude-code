# How Claude Code got here: add a path rule

Claude Code reads the fee code, then writes a rule that loads only for `src/fees/`. You check the glob.
The files in this folder are what it planned and wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Read the money code in ../../../../world/app/src/fees and its tests. Then add a path rule at .claude/rules/money.md. It must load only when you read or edit a file in src/fees/. In the factory the app sits at the repo root, so the paths start at src/, not at world/app/. The rule says every amount is in integer cents, never a float, and names the test file tests/fees/split.test.ts. Keep it under 10 lines, in short plain sentences. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

````text
I read the fee code and its tests. I haven't written anything yet. Here is the plan.

**What the money code does now**
- `src/fees/late.ts`: `lateFeeCents` multiplies the days late by a per-day rate in cents.
- `src/fees/split.ts`: `splitCharge` splits a charge in cents between borrowers. It throws if the total isn't a whole number of cents.
- The tests are `tests/fees/late.test.ts` and `tests/fees/split.test.ts`.

**What I'll add**
One new file, `.claude/rules/money.md`. The `.claude/` folder doesn't exist yet, so I'll create it.

```markdown
---
paths:
  - "src/fees/**"
---

# Money rules

- Every amount is in integer cents.
- Never use a float for money.
- Run tests/fees/split.test.ts after you change the split code.
```

- It's 9 lines.
- The `paths` setting makes it load only when a file under `src/fees/` is read or edited.
- The paths start at `src/`, not `world/app/`.
- I won't touch any code, any tests, or anything in `src/auth/`.

**A bug I found but won't fix:** `splitCharge(3333, 2)` returns `[1666, 1666]`, so one cent goes missing. No test checks an uneven split. Tell me if you want that handled separately.

**How I'll check it:** I'll count the lines, confirm the path is `src/fees/**`, and run `bun run gate` as AGENTS.md asks.

The plan is saved at `/root/.claude/plans/read-the-money-code-wild-cocke.md`. Say go and I'll write the file.
````

## What you check in the plan

- The glob is `src/fees/**`. For example, `src/**` would also load the rule for `src/items/borrow.ts`.
- The paths start at `src/`. A glob that starts at `world/app/` matches nothing in the factory.
- Claude Code found a bug: `splitCharge(3333, 2)` returns `[1666, 1666]`. That is issue 2. It is right
  not to fix it here. One step, one job.

## Prompt 2: approve

```text
Go ahead. Then run bun run verify add-a-path-rule and tell me what it prints.
```

Claude Code asks before it writes under `.claude/`, because that folder holds its own settings. Read the
file it shows you, then approve the write. The check printed `Done. All 6 rules pass.`

## What you reject

- A glob like `src/**`. The `wrong/paths-too-wide/` answer shows it.
- A rule with no frontmatter. It loads in every session, like `AGENTS.md`. The `wrong/no-paths/` answer
  shows it.
- A glob that starts at `world/app/`. The `wrong/world-app-paths/` answer shows it.

```bash
bun run verify add-a-path-rule solution
```

Expect: `Done. All 6 rules pass.`
