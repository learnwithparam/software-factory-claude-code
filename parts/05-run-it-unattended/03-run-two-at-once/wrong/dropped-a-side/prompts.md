# How Claude Code got here: run two at once

You ask Claude Code what two runs could share before you start them. Then you start both yourself. The answer
below is from a real run with Claude Code 2.1.323. `runs/3/` and `runs/5/` hold the two real live runs.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask what could collide

Press Shift+Tab until you see plan mode, then type:

```text
I want to run issues 3 and 5 at the same time: bun run factory 3 --json and bun run factory 5 --json in two terminals. Read factory/run.ts, factory/backlog.json and the two issues in ../../../../world/backlog. Before I start them, tell me: will the two runs share any folder, git branch, gate record or app file? Name anything that could collide. Do not change any file.
```

## What Claude Code answered

```text
**Short answer: no. Issues 3 and 5 share no folder, branch, gate record or app file, so you can start them side by side.** Each run works only in its own `runs/<issue>/` folder. I made no changes.

## Who owns what

| Thing | Run for issue 3 | Run for issue 5 | Shared? |
|---|---|---|---|
| Run folder (deleted with `rmSync` and rebuilt at start, `run.ts:226`) | `runs/3/` | `runs/5/` | No |
| Copy of the app (`run.ts:229`) | `runs/3/repo` | `runs/5/repo` | No |
| Git repo (`git init` in each copy, `run.ts:214`) | its own `.git` | its own `.git` | No |
| Branch | `factory/issue-3` | `factory/issue-5` | No. The names differ, and they live in separate repos anyway |
| Tags `factory-base` and `factory-spec` | in repo 3 | in repo 5 | Same names, different repos, so no clash |
| Gate record (`--record .factory/gate.json`, read by `stop-gate.ts`) | `runs/3/repo/.factory/gate.json` | `runs/5/repo/.factory/gate.json` | No |
| `commands.txt`, `transcripts/`, `result.json`, `hooks.jsonl` (`FACTORY_HOOK_LOG`, `run.ts:329`) | under `runs/3/` | under `runs/5/` | No |
| SQLite database and `events.jsonl` (`db.ts:10` resolves `WORLD` as `src/../..`, which is the run folder in a copy) | `runs/3/data/` | `runs/5/data/` | No. `world/data` is never touched |
| Source files each issue changes (`backlog.json`) | `src/loans/reserve.ts` and its test | `src/items/borrow.ts` and its test | No. The two sets don't overlap, so the branches won't conflict later |

## Read by both, written by neither

Both runs read the same inputs: `world/app`, `world/gate.ts`, `factory/app/`, `factory/stages/*.md` and `factory/backlog.json`. Neither run writes to any of them. The only risk is if you edit one of these files while a run is copying it at the start.

## What could still collide

1. **The same issue number twice.** Starting `factory 3` while another `factory 3` is running deletes the first run's folder from under it (`rmSync(runDir)`). Issues 3 and 5 can't do this to each other.
2. **`LIBRARY_DB` set in your shell.** `db.ts:12` would then point both runs, and any desk test, at one SQLite file, and `seed()` deletes that file before rebuilding it. It isn't set in this environment. Keep it unset in both terminals.
3. **Two different `FACTORY_RUNS` values.** This doesn't break anything. The runs just land in different places, so set it the same way in both terminals or not at all.
4. **Money is capped per run, not overall.** `FACTORY_CAP_USD` (default $10) applies to each process, so two runs can spend up to $20 together. Both also share one Claude account's rate limits. Because of `--no-session-persistence`, neither run writes session files under `~/.claude`.

## Not a problem

- **Port 3000:** only `server.ts` opens it, the gate never starts the server, and no stage is allowed to run it.
- **Outer git repo:** each `runs/<n>/repo` has its own `.git` and matches the `runs/*/repo/` line in `.gitignore`. The other files under `runs/<n>/` will show as untracked in this folder's git status, but nothing from either run reaches it.
```

## What you check in the answer

- Every folder, branch and gate record is named after the issue number. So 3 and 5 never meet.
- The files the two issues change do not overlap. Claude Code reads them from `factory/backlog.json`.
- The cap is per run. Two runs can spend twice the cap together. Keep that in mind for the "Price and ship" part.
- The one real collision is the same issue twice. Do not start issue 3 in two terminals.

## Start both runs

```bash
bun run factory 3 --json & bun run factory 5 --json & wait
```

Expect: two lines that end `draft_pr, runs/3/result.json` and `draft_pr, runs/5/result.json`.

In the real run both reached `draft_pr` with the gate green in round 1. Issue 3 cost $0.28 and issue 5 cost
$0.26. Issue 3 changed `src/loans/reserve.ts` and its test. Issue 5 changed `src/items/borrow.ts` and its test.

## What you reject

- Only one run. The `wrong/one-run-only/` answer has issue 3 and no issue 5.
- Two dry runs. They make no `claude` call and change no file. The `wrong/dry-runs-only/` answer shows it.

```bash
bun run verify run-two-at-once solution
```

Expect: `Done. All 4 rules pass.`
