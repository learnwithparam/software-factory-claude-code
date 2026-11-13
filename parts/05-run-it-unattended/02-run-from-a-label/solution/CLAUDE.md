# Northside factory

This folder is the factory for the Northside Tool Library's lending app. The factory takes one issue from
`world/backlog/` and runs Claude Code on it, stage by stage, with nobody at the keyboard.

## What is here

- `factory/backlog.json`: the decision for each issue (ready, split or refuse), from Part 1.
- `factory/stages/<stage>.md`: the prompt for each stage: triage, spec, build, review.
  `{{number}}`, `{{title}}`, `{{body}}` and `{{feedback}}` are filled in from the issue.
- `factory/app/`: the files every run adds to its copy of the app: `CLAUDE.md`, `.claude/settings.json`,
  the hooks from Part 4 and a `package.json` whose `gate` script runs `.factory/gate.ts`.
- `factory/run.ts`: the runner. `bun run factory <issue>` starts it.

The repo root is the first folder above this one that holds `world/backlog/`. The app is `world/app/` there,
and the gate is `world/gate.ts`.

## The factory contract

`bun run factory <issue> [--dry-run] [--json]`

1. Make a fresh copy of the app in `<runs>/<issue>/repo`: `world/app` (without `node_modules`), then
   `factory/app/`, then `world/gate.ts` as `.factory/gate.ts`. `<runs>` is `$FACTORY_RUNS`, or `runs`
   in this folder. Make it a git repo, commit, tag `factory-base`, then switch to branch
   `factory/issue-<issue>`.
2. Run the stages in that copy, each as one `claude -p` call: triage, spec, build, review.
   Set `FACTORY_STAGE=<stage>` for each call; the hooks read it.
3. Triage decides: refuse ends the run as `refused`, plan only ends it as `stopped_at_plan`.
4. After each build round, run `bun run gate` in the copy. Give the builder at most 2 rounds.
   If the gate still fails, the run ends as `gate_failed`.
5. A review verdict of `block` ends the run as `gate_failed`. A pass ends it as `draft_pr`.
6. Write three things under `<runs>/<issue>/`. `commands.txt` has one line per `claude -p` call, with the
   prompt replaced by its stage file name. `transcripts/<stage>.jsonl` holds what `claude -p` printed.
   `result.json` has the shape of `checks/lib/result.ts` at the repo root.
   `cost_usd` is the sum of `total_cost_usd` from the result line of each transcript.
7. With `--json`, print only the result JSON on stdout. Progress goes to stderr.

`--dry-run` makes no `claude` call and spends nothing. It still makes the copy and writes the lines it
would run to `commands.txt`. It runs the real gate after each build round. Its `result.json` has
`pr_url: null`, `review: null`, `cost_usd: 0` and `claude_runs: []`. Triage's answer comes from
`factory/backlog.json`: ready means go on, refuse means `refused`, split means `stopped_at_plan`.
With `FACTORY_DRY_GATE=fail` the dry run treats every gate as failed, to test the retry limit.

## Rules for every claude -p call

- Name a permission mode (`--permission-mode dontAsk`) and the tools the stage may use (`--allowedTools`).
- Cap it: `--max-turns` and `--max-budget-usd`.
- `--output-format stream-json --verbose`, so the transcript has every tool call and the cost.
- `--setting-sources project,local`, so every machine runs the same hooks.
- Never `--bare`: it skips the hooks, and the hooks are the gates.

## Code style

Whole-word names, one idea per line, functions of 40 lines or fewer, lines of 100 characters or fewer.
Run `bun run readable` at the repo root before you finish.
