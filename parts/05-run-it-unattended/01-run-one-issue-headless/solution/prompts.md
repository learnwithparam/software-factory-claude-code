# How Claude Code got here: run one issue headless

Claude Code wrote `factory/run.ts`. You read its plan, steer it, and run the factory. The files in this folder
are what it wrote in a real run with Claude Code. `runs/1/` holds the real live run of issue 1:
its result, its commands, its transcripts and the console it printed.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world --add-dir ../../../../checks
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

Press Shift+Tab until you see plan mode, then type:

```text
Read CLAUDE.md, the stage prompts in factory/stages, the files in factory/app, and ../../../../checks/lib/result.ts. Then plan factory/run.ts: the runner that answers the factory contract in CLAUDE.md. Each stage is one claude -p call with a permission mode, its allowed tools, --max-turns, --max-budget-usd and stream-json output, and never --bare. Triage and review return JSON through --json-schema. The builder gets at most 2 gate rounds. --dry-run makes no claude call. Show me the plan: the flags for each stage, how the retry loop stops, and what the dry run does. Do not write any file yet.
```

## The plan Claude Code showed

```text
I've written the plan for `factory/run.ts` to `~/.claude/plans/read-claude-md-the-stage-zany-hartmanis.md`; nothing else has been written. Two things shape it: `world/finished/run.ts` already has a working version of this runner that I copied patterns from, and `config/claude-code.ts` already holds the shared headless flags and model names, which `run.ts` will reuse.

## Flags for each stage
Every call is `claude -p <prompt> --model <alias>` plus the shared headless flags: `--output-format stream-json --verbose --include-hook-events --permission-mode dontAsk --setting-sources project,local --no-session-persistence`. Then each stage adds its own:

| stage | model | `--allowedTools` | `--max-turns` | `--max-budget-usd` | `--json-schema` |
|---|---|---|---|---|---|
| triage | haiku | `Read,Grep,Glob` | 12 | 0.5 | type, risk, files, decision (`proceed`/`refuse`/`plan_only`), reason |
| spec | sonnet | `Read,Grep,Glob,Edit,Write,Bash(bun test *),Bash(bun run gate)` | 30 | 2 | - |
| build | sonnet | same as spec (the hooks lock the tests and won't let it stop until the gate passes) | 40 | 3 | - |
| review | sonnet | `Read,Grep,Glob,Bash(git diff *)` | 20 | 1.5 | verdict (`pass`/`block`), findings with file, line, evidence |

- `--bare` is never used.
- Each call runs in the copy with `FACTORY_STAGE=<stage>` set.
- The triage and review answers come from the `structured_output` field of the transcript's last line. That line also gives `total_cost_usd` and the turn count.

## How the retry loop stops
- **Round 1:** the builder runs, the runner commits, then runs `bun run gate`.
- **Round 2:** only if the gate failed. The builder is told which tests are failing.
- **It stops when:**
  - the gate passes;
  - total spend goes over a cap, which ends the run as `stopped_budget` (cap from `FACTORY_CAP_USD`, default $10; that variable is my addition, not in CLAUDE.md);
  - two rounds have run and the gate still fails, which ends the run as `gate_failed` without a review.
- If the builder errors out or runs out of turns, the loop carries on: only the gate result decides.
- I made two choices CLAUDE.md doesn't cover:
  - If triage returns no answer, the run ends as `stopped_at_plan`, so nothing gets built without a decision.
  - If review returns no verdict, the run ends as `gate_failed`.

## What the dry run does
- It never starts `claude`, but still writes every command it would run to `commands.txt`.
- It makes the same fresh copy, git repo, `factory-base` tag and branch.
- Triage comes from `factory/backlog.json`: ready goes on, refuse ends as `refused`, split ends as `stopped_at_plan`.
- It runs the real gate after each build round. The app is unchanged, so it should pass on round 1.
- With `FACTORY_DRY_GATE=fail`, every gate counts as failed. That gives exactly two build rounds and `gate_failed`.
- When the gate passes, the result is `draft_pr` with `pr_url: null`, `review: null`, `cost_usd: 0` and `claude_runs: []`.
- `roles_by_stage` is `"none"` for every stage, since no model ran. That's my choice; CLAUDE.md doesn't say.

## Testing it
I'd run dry runs on issues 6 (expect `refused`), 7 (`stopped_at_plan`) and 2 (`draft_pr`), then issue 2 with `FACTORY_DRY_GATE=fail` (`gate_failed`). Each `result.json` gets checked against `checks/lib/result.ts`, and `bun run readable` runs at the end. A live run costs money, so I'd only do one if you say so.

Say the word and I'll write `factory/run.ts`.
```

## What you check in the plan

- Every stage names its tools and a permission mode. A bare `claude -p` would deny every tool that asks.
- Every stage has both caps: `--max-turns` and `--max-budget-usd`.
- No `--bare`. The plan says so in one line.
- The retry loop has a fixed end: 2 rounds, then `gate_failed`.
- Two things to push back on. The plan imports `config/claude-code.ts` from outside this folder, so a copy
  of the folder would break. And a dry run records the role of each stage as `none`, which hides the routing.

## Prompt 2: steer, then approve

```text
Good plan. Three changes before you write it. First, do not import anything from outside this folder: no config/ and no checks/ import, because this folder must also run when it is copied somewhere deeper. Keep the model aliases and flags in factory/run.ts and find the repo root by walking up. Second, in a dry run record the role each stage would use in roles_by_stage, not "none", so a dry run shows the routing. Third, keep FACTORY_CAP_USD with a default of 10. Now write factory/run.ts. Then run bun run factory 1 --dry-run --json, bun run factory 6 --dry-run --json, and FACTORY_DRY_GATE=fail bun run factory 1 --dry-run --json, and run bun run readable at the repo root and fix what it reports in factory/run.ts. Do not start a live run.
```

## What Claude Code reported

```text
I've written `factory/run.ts` with your three changes. All three dry runs gave the expected result, and `bun run readable` now passes. No live run was started and nothing was spent.

**Your three changes:**
- **No imports from outside the folder:** the only imports are `node:fs` and `node:path`. The model names, shared flags, schemas, issue-file reader and result types all live in `run.ts`. It finds the repo root by walking up to the first folder that holds `world/backlog/`.
- **Roles in a dry run:** `roles_by_stage` records the role of each stage the run reached, so a dry run shows the routing.
- **Budget cap:** `FACTORY_CAP_USD` defaults to 10. Going over it, or a stage hitting its own `--max-budget-usd`, ends the run as `stopped_budget`.

**Dry runs:**

| command | state | gate | `roles_by_stage` |
|---|---|---|---|
| `bun run factory 1 --dry-run --json` | `draft_pr` | passed on round 1 | triage fast, spec smart, build smart, review judge |
| `bun run factory 6 --dry-run --json` | `refused` | none | triage fast |
| `FACTORY_DRY_GATE=fail bun run factory 1 --dry-run --json` | `gate_failed` | failed after 2 rounds | triage, spec, build (no review) |

- With `--json`, stdout parses as JSON and progress goes to stderr.
- `runs/1/result.json` and `runs/6/result.json` both pass `checks/lib/result.ts`. I checked that from a one-off command, not from `run.ts`.
- For the failing-gate run, `commands.txt` has four lines: triage, spec, build, build. No line contains `--bare`.
- Every line carries the flags from the plan, with the prompt replaced by its stage file name, e.g. `factory/stages/build.md`.

**What `readable` reported, and the fixes:**
- 10 lines over 100 characters, plus formatting: I split long expressions and broke up the function signatures.
- Two one-letter names (`t`, `e`): renamed to whole words.
- `FACTORY_STAGE` and `FACTORY_HOOK_LOG` failing the naming lint: they're now set on the environment object one at a time.
- `cost_usd`: it's a key `result.json` requires in snake_case, so I left it and added a lint-ignore comment for that line.

I also split the claude call into three functions so each stays under 40 lines.

**Not tested yet:**
- The live path hasn't run. That covers starting `claude`, reading cost, turns and structured answers from the transcript, spotting tool calls a hook blocked, and the review verdict.
- `.gitignore` only ignores `runs/*/repo/`, so the other files under `runs/<issue>/` (`commands.txt`, `result.json`, transcripts) show up in `git status`. Ignoring them is a one-line change if you want it.
```

## Prompt 3: run it for real, then fix what you see

Leave Claude Code and run the factory on issue 1 in this folder:

```bash
bun run factory 1 --json
```

Expect: the last progress line says `factory: issue 1: draft_pr, runs/1/result.json`.

The real run reached `draft_pr`. The gate passed in round 1 and the review passed. But `result.json` held an
absolute path from the machine it ran on. Back in Claude Code:

```text
The live run of issue 1 ended in draft_pr: gate green in round 1, review pass, $0.51. One thing to change: result.json records the worktree as an absolute path on my machine. Record it relative to this folder, like runs/1/repo, so the result means the same on any machine. Change only that, run bun run factory 1 --dry-run --json to show it, and run bun run readable at the repo root.
```

Then the live run went again, and its result is the one in `runs/1/result.json` here: `draft_pr`, gate
round 1, review `pass`, cost $0.24.

## What you reject

- `--bare` on any call. It skips the hooks. The `wrong/bare-flag/` answer shows it.
- A call with no `--max-budget-usd` or `--max-turns`. The `wrong/no-spend-cap/` answer shows it.
- A retry loop with no end, or a far end. The `wrong/retries-until-green/` answer gives the builder 5 rounds.

```bash
bun run verify run-one-issue-headless solution
```

Expect: `Done. All 10 rules pass.`
