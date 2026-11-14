# How Claude Code got here: cap the spend

Claude Code changed `factory/run.ts`, emptied the token out of `factory/ci.env`, and added `.env.example`.
The files in this folder are what it wrote in a real run with Claude Code. The `.env` it made holds
the token, so git ignores it and it is not here.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world --add-dir ../../../../checks
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

Press Shift+Tab until you see plan mode, then type:

```text
Two problems with spend and secrets. First, the run cap FACTORY_CAP_USD only looks at what a run has already spent, so a run can start a stage that blows past the cap: with FACTORY_CAP_USD=0.05 a dry run of issue 1 still ends in draft_pr. Plan a change so that before each stage starts, run.ts adds that stage's --max-budget-usd to what the run has spent so far. If the total would go over the cap, the stage does not start and the run ends as stopped_budget. A dry run follows the same rule, so FACTORY_CAP_USD=0.05 stops before triage. Keep the default cap at 10. Second, factory/ci.env is a tracked file with a token in it. Plan how to move the token out of every tracked file into a git-ignored .env, and say what the build server should use instead. Show me the plan. Do not write any file yet.
```

## The plan Claude Code showed

```text
I haven't changed any project files; the only file I wrote is the plan at `~/.claude/plans/two-problems-with-spend-vivid-nebula.md`. Nothing has been run either, so the expected results below are predictions.

## 1. Check the cap before each stage (`factory/run.ts`)

Today the cap is only checked after a stage has spent money (`run.ts:377`). A dry run never spends anything, so it never reaches the cap.

- **New helper `fitsBudget(run, stage)`:** if what the run has spent plus the stage's `--max-budget-usd` is over the cap, it marks the budget as hit, prints why, and returns false. Landing exactly on the cap is allowed.
- **Where it's called:** at the very start of `runClaude`, before the stage's line goes into `commands.txt` and before its role is recorded. A stage that never starts leaves no trace in `commands.txt` or `roles_by_stage`.
- **Stopping after a skipped stage:**
  - `spec` and `plan` return before making their commit and tag.
  - `buildLoop` returns `"budget"` before the gate runs.
  - `reviewStage` returns `stopped_budget` before the dry run's `draft_pr`.
  - `runStages` already stops on a hit budget, so it doesn't change.
- **The existing check after each stage stays** as a second safety net.
- **Cap value:** read in one place. The default stays 10. A value that isn't a number of 0 or more (for example empty or misspelled) now exits with an error. Today such a value quietly becomes `NaN` or 0, and `NaN` turns the cap off.

With `FACTORY_CAP_USD=0.05`, a dry run of issue 1 should end as `stopped_budget`, with an empty `commands.txt` and `roles_by_stage: {}`. That shape still fits `checks/lib/result.ts`. With the default 10 it should still reach `draft_pr`, because the biggest single stage (build, $3) fits.

## 2. Move the token out of tracked files

The token hasn't been committed yet: `git grep sk-ant-` finds nothing and this folder has no commits. So no history rewrite is needed.

- **`factory/ci.env`:** remove the token line and keep `FACTORY_CAP_USD=10`, which isn't a secret.
- **New `.env` in the solution folder** holding the token. Bun loads `./.env` on its own, and `run.ts` already passes the environment through to `claude`, so the code doesn't change. This folder's `.gitignore` and the root `.gitignore` already ignore `.env`.
- **New tracked `.env.example`** with an empty `CLAUDE_CODE_OAUTH_TOKEN=` and a note to create the token with `claude setup-token`.
- **`CLAUDE.md`:** a short "Secrets and spend" section.

**What the build server should use:** put `CLAUDE_CODE_OAUTH_TOKEN` in the CI system's secret store and pass it in as an environment variable, for example `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` in GitHub Actions. Use `ANTHROPIC_API_KEY` instead if you pay through the API. `FACTORY_CAP_USD` can be a plain variable. The server should never write a `.env` file. On a real server you would also revoke the pasted token and create a new one.

## Decision for you

`problem/factory/ci.env` has the same fake token. It's the exercise's starting state, so the plan leaves it alone. But a secret scan of the whole repo, not just this folder, would find it there. Do you want it scrubbed too?

The plan also lists the checks to run afterwards: dry runs with caps of 0.05, 2, 10 and an invalid value, the retry-limit run, a `git grep` for the token, and `bun run readable`.
```

## What you check in the plan

- The check runs before the stage starts, with the stage's own max budget added. That is what makes a dry run
  stop too.
- A cap that is not a number now stops the run with an error, instead of switching the cap off.
- The token goes to `.env`, which `.gitignore` already lists. The build server gets it from its secret store.
- A real token that was pasted into a file must also be revoked. Claude Code says so.
- Claude Code asks about `problem/factory/ci.env`. It is the starting state of the exercise, so you leave it.

## Prompt 2: answer the question, then approve

```text
Leave problem/ alone: it is the starting state of the exercise, and its token is a fake. Go ahead with the plan in this folder only. Then run the dry runs with FACTORY_CAP_USD=0.05, 3 and the default, run git grep for sk-ant- on the tracked files, and run bun run readable at the repo root and fix what it reports. Do not start a live run.
```

## What Claude Code reported

```text
A stage now starts only if what the run has already spent plus its own `--max-budget-usd` fits under the cap. With `FACTORY_CAP_USD=0.05`, a dry run of issue 1 now stops before triage as `stopped_budget`. The token is out of every tracked file in this folder. `problem/` is untouched and no live run was started.

## What changed (solution folder only)

- **`factory/run.ts`**:
  - A new `fitsBudget` check runs first in `runClaude`, before the stage's command is logged or its role recorded. A stage that doesn't start leaves no trace.
  - Spec, plan, build and review all stop when the budget is hit, so a skipped build round never runs the gate.
  - The cap is read in one place: the default is still 10, and a value that isn't a number of 0 or more now exits with an error instead of quietly switching the cap off.
  - The check that runs after each stage is kept.
- **`factory/ci.env`**: the token line is gone. It keeps `FACTORY_CAP_USD=10` and says the token comes from the build server's secret store.
- **`.env`** (git-ignored) holds the token for local runs; Bun loads it automatically. **`.env.example`** shows the variable name with no value.
- **`CLAUDE.md`**: a short "Secrets and spend" section.

## Results

| Run | State | Notes |
|---|---|---|
| `FACTORY_CAP_USD=0.05` dry run | `stopped_budget` | Triage didn't start ($0.50 > $0.05). `commands.txt` is empty, `roles_by_stage` is `{}`, `gate` is null. |
| `FACTORY_CAP_USD=3` dry run | `draft_pr` | Expected, see below. |
| Default cap dry run | `draft_pr` | Same as before. |
| `FACTORY_CAP_USD=2.5` dry run (extra) | `stopped_budget` | Build ($3) didn't start and the gate never ran. |
| `FACTORY_DRY_GATE=fail` dry run (extra) | `gate_failed` | Still stops after 2 rounds. |

**About the $3 run:** a dry run spends nothing, so each stage is only compared with the cap on its own. Build's $3 budget lands exactly on the cap, which is allowed. A live run adds real spend, so with a $3 cap, triage plus spec would usually leave too little for build.

**`git grep sk-ant-`** found nothing, including with `--untracked`, which also covers files `git add` would pick up. I could only run git inside this folder, because it's outside the folders I'm allowed to access. A scan of the whole repo would still find the fake token in `problem/factory/ci.env`, as you decided.

**`bun run readable`** first failed: the extra budget check pushed `buildLoop` over the complexity limit (11, max 10). I moved one round into a new `buildRound` function, re-ran readable (it passes), and re-ran the default and failing-gate dry runs above with the same results.

**Build server:** store `CLAUDE_CODE_OAUTH_TOKEN`, made with `claude setup-token`, in the CI secret store and pass it to the job as an environment variable. In GitHub Actions that's `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`; use an `ANTHROPIC_API_KEY` secret instead if you pay through the API. The server shouldn't write a `.env` file. With a real token, you would also revoke the one that was pasted into `ci.env`.

Nothing is committed.
```

## What you reject

- A cap that only counts money already spent. The `wrong/cap-after-spending/` answer moved the token but kept
  the old cap, so a dry run never stops.
- A token left in a tracked file. The `wrong/token-still-tracked/` answer fixed the cap but kept the token in
  `factory/ci.env`.

```bash
bun run verify cap-the-spend solution
```

Expect: `Done. All 5 rules pass.`
