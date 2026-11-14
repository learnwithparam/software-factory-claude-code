# Run one issue headless

## The problem

The factory runs unattended. It uses `claude -p`: Claude Code gets one
prompt, works, prints its result and exits.

A `claude -p` call with no limits can loop and spend. And `--bare` skips
the project's hooks, so the test lock and Stop gate vanish silently.

For example, `factory/run.ts` in this folder only prints a not built yet note and exits 1.

```mermaid
flowchart LR
  I[bun run factory 1] --> C[copy of the app in runs/1/repo]
  C --> T[triage] --> S[spec] --> B[build]
  B --> G{gate}
  G -- fail, round 1 --> B
  G -- fail, round 2 --> F[gate_failed]
  G -- pass --> R[review] --> O[runs/1/result.json]
```

## Your challenge

Get Claude Code to write the runner `factory/run.ts`. `CLAUDE.md` here holds its contract.

Start Claude Code from the repo root:

```bash
cd parts/05-run-it-unattended/01-run-one-issue-headless/problem
claude --add-dir ../../../../world --add-dir ../../../../checks
```

Expect: Claude Code opens and waits for your prompt.

Ask for a plan first:

```text
Read CLAUDE.md, factory/stages, factory/app and ../../../../checks/lib/result.ts. Then plan factory/run.ts, the runner for the factory contract in CLAUDE.md. Each stage is one claude -p call with a permission mode, its tools, --max-turns, --max-budget-usd and stream-json output, never --bare. The builder gets at most 2 gate rounds. Show me the flags per stage, how the retry loop stops, and what the dry run does. Write nothing yet.
```

Check the flags and the 2-round limit. Then type:

```text
Go ahead. Write factory/run.ts now.
```

Then type `/exit` and try a free dry run:

```bash
bun run factory 1 --dry-run --json
```

Expect: one JSON object with `"state": "draft_pr"`, `"pr_url": null` and `"cost_usd": 0`.

Last, run issue 1 for real, about $0.25:

```bash
bun run factory 1 --json
```

Expect: the last progress line says `factory: issue 1: draft_pr, runs/1/result.json`.

![The live run of issue 1 ending in draft_pr](../images/expected.png)

Then do the [session moves](SESSION-MOVES.md).

## Done when

- The dry run of issue 1 prints one result in the contract's shape and saves it.
- `commands.txt` lists one `claude -p` call per stage, with permissions, both caps and JSON output.
- Nothing uses `--bare`.
- Issue 6 stops at triage. A gate that keeps failing gets 2 build rounds, then `gate_failed`.
- A live run of issue 1 ends in `draft_pr`, and its cost is the sum of its transcripts.
- Your saved session shows the session moves.

Ask Claude Code:

```text
Run `bun run verify run-one-issue-headless` and tell me what it printed. Do not change anything to make it pass.
```

```bash
bun run verify run-one-issue-headless
```

Expect: `Done. All 12 rules pass.`

## If you get stuck

| What you see                                                    | What to do                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Ignoring 5 permissions.allow entries ... has not been trusted` | Nothing. The copy is a new folder, so Claude Code skips its allow list. Each call names its tools with `--allowedTools`. |
| `FAIL ... 2 rounds`                                             | Run `FACTORY_DRY_GATE=fail bun run factory 1 --dry-run --json` and count the build lines in `runs/1/commands.txt`.       |
| `FAIL a live run of issue 1 ...`                                | Run `claude auth status`. Then run issue 1 again without `--dry-run`.                                                    |

## Words you will use

- **Headless**: Claude Code runs with no person to answer it. `claude -p` is the headless mode.
- **Dry run**: the factory does every step except the `claude` calls, so you can test it for free.
- **Transcript**: the stream-json lines one `claude -p` call printed, cost included.
- **Retry loop**: the builder gets one more round when the gate fails, up to a limit.
