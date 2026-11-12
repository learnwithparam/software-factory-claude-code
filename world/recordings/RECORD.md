# Recordings: real Claude Code runs

Every recording here is a real `claude -p` run of the finished factory, made with a signed-in Claude Code.
Nothing here is written by hand. `bun run finished <issue>` replays one when `claude` is missing, signed out,
or `CI` is set, and `tests/lib.test.ts` replays all of them.

Each run folder holds:

| Path | What it is |
|---|---|
| `run.json` | the issue, the Claude Code version that made the run, and the date |
| `commands.txt` | the exact `claude -p` command of each stage, run inside `repo/` with `FACTORY_STAGE` set |
| `transcripts/<stage>.jsonl` | the stream-json Claude Code printed for that stage, line for line |
| `hooks/<stage>.jsonl` | every event Claude Code sent the factory's hooks on stdin, one JSON object per line |
| `patches/<stage>.patch` | what the stage changed in the app copy (`git diff --cached` after the stage) |
| `result.json` | the result the live run wrote |

## What is recorded

| Recording | Command (run at the repo root) | Folder Claude Code runs in | Output goes to | Made with |
|---|---|---|---|---|
| issue 2, run 1 | `bun run finished 2 --record run-1` | `runs/finished-2/repo/` (a fresh copy of the app plus `world/finished/factory/`) | `world/recordings/issue-2/run-1/` | Claude Code 2.1.322 |
| issue 2, run 2 | `bun run finished 2 --record run-2` | `runs/finished-2/repo/` | `world/recordings/issue-2/run-2/` | Claude Code 2.1.322 |
| issue 2, run 3 | `bun run finished 2 --record run-3` | `runs/finished-2/repo/` | `world/recordings/issue-2/run-3/` | Claude Code 2.1.322 |
| issue 6, run 1 | `bun run finished 6 --record run-1` | `runs/finished-6/repo/` | `world/recordings/issue-6/run-1/` | Claude Code 2.1.322 |

Issue 2 has three runs because what Claude Code writes varies from run to run: the tests check that all three
reach a draft PR with the gate green, no test file edited in the build, and the review passing.

## To record them again

Do this after any change to `world/finished/` or `world/app/`, on a machine where `claude auth status` says
`"loggedIn": true`. Each issue 2 run uses about 0.25 USD of estimated usage on your plan.

```bash
for r in run-1 run-2 run-3; do bun run finished 2 --record "$r"; done && bun run finished 6 --record run-1 && bun test
```

Expect: each run ends `finished: recorded into world/recordings/issue-<n>/<run>`, then `bun test` ends `0 fail`.

`--record` refuses to run without a signed-in `claude`. Commit the new folders as they are. The transcripts
hold the full model ids Claude Code reports; they are raw recordings and are never shown as they are: the
replay prints tool calls, hooks, gates and costs only.

## Not recorded yet

The part sessions add their own recordings here (the triage skill on issue 6, the planner on issue 3, the
reviewer on the clean and the planted diff), each with a row in the table above.
