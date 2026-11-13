# Parts: the build map

Every part, its steps, minutes, and what each step's check reads. A part session starts from this file alone.
Parts 0 and 1 are built. Parts 2 to 6 are skeletons: a README with the problem, a cited number, a diagram,
the step table and a Walkthrough marked `TODO(part session)`. Total: 350 minutes (335 core plus one 15 minute
elective).

| Part folder                     | Question it answers                     | Steps (minutes)                                                                                                       | Part minutes | State    |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ | -------- |
| `parts/00-meet-the-library`     | what are we building                    | `meet-the-library` (15)                                                                                               | 15           | built    |
| `parts/01-write-the-work-order` | does it know what done looks like       | `write-the-issue-form` (15), `size-the-backlog` (10), `write-the-spec` (25)                                           | 50           | built    |
| `parts/02-teach-the-repo`       | what must it know, what may it touch    | `trim-the-agents-file` (15), `add-a-path-rule` (10), `package-the-triage-skill` (20)                                  | 45           | skeleton |
| `parts/03-split-the-roles`      | can it check its own work               | `split-planner-and-builder` (20), `isolate-the-builder` (10), `build-the-reviewer` (20), `catch-the-planted-bug` (15) | 65           | skeleton |
| `parts/04-gate-the-agent`       | who has the last word                   | `deny-the-shortcuts` (10), `lock-the-tests` (20), `demand-proof-before-stop` (15), `protect-the-main-branch` (15)     | 60           | skeleton |
| `parts/05-run-it-unattended`    | what stops it, where does the result go | `run-one-issue-headless` (25), `run-from-a-label` (25), `run-two-at-once` (15, elective)                              | 65           | skeleton |
| `parts/06-price-and-ship`       | what did it cost, was it worth it       | `route-models-by-stage` (15), `cap-the-spend` (10), `ship-the-factory` (25)                                           | 50           | skeleton |
| `parts/07-track-agent-cost`     | can anything go around the cap          | `track-agent-cost` (15, optional, homework)                                                                           | 15           | built    |

## What each step's check reads

| Step                        | The check reads                                                                                                                                                                                                                                                | Keyless?                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `meet-the-library`          | `bun run doctor` exit code; `runs/finished-2/result.json` (written by `bun run finished 2`, live or replayed) against `checks/lib/result.ts` with its `claude_runs`; `notes/goal.md` names an issue 1 to 7 and a reason                                        | yes                                                             |
| `write-the-issue-form`      | `.github/ISSUE_TEMPLATE/change.yml` in the step folder: parses, required textareas `outcome`, `acceptance`, `must-not-change`, `out-of-scope`, dropdown `risk`; issue 5's answers render through it with every required field filled                           | yes                                                             |
| `size-the-backlog`          | `factory/backlog.json`: all 7 issues, issue 6 `refuse` naming `src/auth/`, issue 7 not `ready`, each `ready` issue names 1 to 5 app files that exist                                                                                                           | yes                                                             |
| `write-the-spec`            | `specs/5/SPEC.md` sections and EARS lines, `specs/5/passes.json` one entry per requirement, all `passes: false`, each naming a test under `tests/`                                                                                                             | yes                                                             |
| `trim-the-agents-file`      | `AGENTS.md` (under 80 lines, Commands, Protected paths, Done when, names `bun run gate`, no line that only names a folder) and `CLAUDE.md` holding `@AGENTS.md`                                                                                                | yes                                                             |
| `add-a-path-rule`           | `.claude/rules/money.md` frontmatter `paths`, matched against app file paths; body names integer cents and the test file                                                                                                                                       | yes                                                             |
| `package-the-triage-skill`  | `.claude/skills/triage/SKILL.md` frontmatter (a skill that loads) and reply contract; three recorded `claude -p "/triage 6"` runs in the sample solution (`world/recordings/`, listed in `RECORD.md`) whose final result ends `DECISION: refuse` in at least 2 | static rules yes; the 3 runs are recorded with real Claude Code |
| `split-planner-and-builder` | `.claude/agents/planner.md`, `builder.md` frontmatter tools and model; the `plan.md` a recorded `claude -p` run of the planner wrote for issue 3                                                                                                               | yes (recorded run)                                              |
| `isolate-the-builder`       | builder `isolation: worktree`; `.worktreeinclude`; a dry run of `git worktree add` and remove                                                                                                                                                                  | yes                                                             |
| `build-the-reviewer`        | `.claude/agents/reviewer.md` tools and JSON contract; the verdicts of 3 recorded `claude -p --agent reviewer` runs on the clean diff                                                                                                                           | yes (recorded runs)                                             |
| `catch-the-planted-bug`     | reviewer verdicts on `world/fixtures/diffs/issue-3-offbyone.diff` and a clean diff, from 3 recorded `claude -p --agent reviewer` runs each, pass on 2                                                                                                          | yes (recorded runs)                                             |
| `deny-the-shortcuts`        | `.claude/settings.json` `permissions.deny`, matched by `checks/lib/permissions.ts` against recorded calls                                                                                                                                                      | yes                                                             |
| `lock-the-tests`            | the PreToolUse hook named in settings, run by `checks/lib/run.ts runHook` on recorded events, including the planted bad command `sed -i ... tests/fees/split.test.ts`                                                                                          | yes                                                             |
| `demand-proof-before-stop`  | the Stop hook, run on recorded Stop events with and without a fresh gate record (`world/gate.ts --record`)                                                                                                                                                     | yes                                                             |
| `protect-the-main-branch`   | `gate.yml`, `CODEOWNERS`, `factory/ruleset.json` in the step folder, offline                                                                                                                                                                                   | yes                                                             |
| `run-one-issue-headless`    | `bun run factory 1 --dry-run --json` against the contract; the flags in `factory/run.ts`; live: branch `factory/issue-1` passes the local gate via `checks/lib/git.ts gateOnBranch`                                                                            | dry run yes                                                     |
| `run-from-a-label`          | `.github/workflows/factory.yml` in the step folder, offline                                                                                                                                                                                                    | yes                                                             |
| `run-two-at-once`           | two result files, two worktrees, `changedFiles` of both branches do not overlap                                                                                                                                                                                | no                                                              |
| `route-models-by-stage`     | agent `model` fields and `roles_by_stage` in result files                                                                                                                                                                                                      | dry run yes                                                     |
| `cap-the-spend`             | a run with `FACTORY_CAP_USD=0.05` ends `stopped_budget`; a scan of tracked files for key patterns                                                                                                                                                              | dry run yes                                                     |
| `ship-the-factory`          | `runs/<n>/result.json` for 1 to 7, each claim confirmed against git (branches pass the local gate, no test file in the diff) and the logged `claude -p` JSON costs; `notes/retro.md`                                                                           | no                                                              |

## Rules for part sessions

1. **The step folder is the learner's workspace.** The learner opens `claude` inside `problem/` and writes
   `.claude/`, `factory/`, `specs/` and notes there. Checks take that folder as their only argument
   (`scripts/verify.ts` passes `problem/`, `solution/` or a `wrong/<mistake>/`).
2. **The world is read-only to checks.** Use `checks/lib/world.ts` for the backlog, the app's file list and the
   gate. A step that needs the app changed copies it first (see `freshCopy` in `world/finished/run.ts`) or uses
   `checks/lib/git.ts`, which works in a throwaway worktree.
3. **The learner works in the real Claude Code; nothing calls the model API.** Follow
   `briefs/build/CLAUDE-CODE.md` on the curriculum repo's `cloud-briefs` branch. A check reads what Claude
   Code produced (files, git history, `result.json`, the stream-json transcript of a `claude -p` run), never a
   reply. Hooks are tested by piping them the exact JSON Claude Code sends: reuse the real events in
   `world/recordings/issue-2/run-*/hooks/*.jsonl` (see `tests/lib.test.ts`). Behaviour that varies run to run
   is judged over 3 recorded runs, pass on 2. Record runs with a signed-in `claude` on the sample solution,
   save the stream-json and the files the run produced under `world/recordings/`, and add each one to
   `world/recordings/RECORD.md` with its exact command, folder and output path. Never hand-write a transcript.
   A wrong answer must fail on its static rules, not on a missing recording.
4. **No full model id anywhere.** Stages and agents ask for a role (`fast`, `smart`, `judge`); the Claude Code
   alias for each role (`haiku`, `sonnet`) lives in `config/claude-code.ts`, with the headless flags and the
   oldest tested Claude Code version. `result.json` records roles.
5. **The finished factory** in `world/finished/` is what `bun run finished` runs: `factory/` (its `CLAUDE.md`,
   `.claude/settings.json` and hooks), `stages/` (one prompt per stage) and `run.ts`. Its hooks are the reference
   for `lock-the-tests` and `demand-proof-before-stop`. If you change it, record its runs again
   (`bun run finished 2 --record run-1`, then `run-2` and `run-3`) and keep `tests/lib.test.ts` green.
6. **No live GitHub to pass a check.** Workflow, CODEOWNERS and ruleset files sit in the step folder and are
   checked offline. A learner with a GitHub repo can apply them; that is an extension, never a rule.
7. **Screenshots** come from `bun run shots` (`images/capture.ts`); add each new step's picture to its `SHOTS` list.
8. Remove every `TODO(part session)` from a part's README once it has steps; `bun run check` fails otherwise.
