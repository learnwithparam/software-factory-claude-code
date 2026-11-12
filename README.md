# Software Factory on Claude Code

Let Claude Code turn an issue into a pull request you can trust, and know what it cost.

**For** tech leads, staff and senior engineers who already use Claude Code at work and want it to take an
issue to a reviewed draft pull request while they are away, without edited tests or a surprise bill.

**You leave with** a factory in a repo: a typed issue goes in; a spec, a plan, a build in its own worktree, a
gate the agent cannot skip, a reviewer that must show evidence, and a draft pull request with its cost
come out. Every step is checked by a script you run. You do the work in the real Claude Code, signed in
with your own Claude account; no step asks for an API key.

## Run the finished system first

You need Bun 1.4 or newer and Claude Code (the `claude` CLI, signed in with a Pro, Max or Console account;
see [00-orientation](00-orientation/README.md) to install it).

```bash
bun install
```

Expect: `bun install` ends with no errors.

```bash
bun run world
```

Expect: `world: Northside Tool Library is ready: 12 tools, 8 members, 4 loans out (1 overdue), 7 open issues.`

```bash
bun run finished 2
```

Expect: `finished: issue 2 ended in draft_pr. Gate pass after 1 build round, 0 edits blocked by a hook, 0 test files edited in build, review pass,` then the cost.

![The finished factory on issue 2: triage, a spec with failing tests, a build that makes them pass, a review](images/finished-system.png)

Each stage of the finished factory is one real Claude Code run, `claude -p`, in a fresh copy of the app that
holds the factory's own `CLAUDE.md`, `.claude/settings.json` and hooks (`world/finished/factory/`). With
`claude` installed and signed in, the command runs live on your account, and the cost line is what Claude
Code reported. Without it, or in CI, it says so in one line and replays a recorded real run from
`world/recordings/`: it shows that run's transcript, applies the changes it made to a fresh copy, runs the
gate (the app's tests) for real, and runs the factory's hooks again on the exact events Claude Code sent them.
`bun run finished 2 --replay` replays even when `claude` is ready.

```bash
bun run finished 6
```

Expect: `finished: issue 6 ended in refused.` Issue 6 needs a change under `src/auth/`, which the factory refuses.

```bash
bun run scorecard
```

Expect: `scorecard: 0 of 6 targets met. You have no runs yet; the replay does not count.` These are the
targets your own factory meets by the end.

## The world and what you build

Northside Tool Library is a member-run library that lends drills, ladders and a chainsaw. Its lending app
(TypeScript, Bun, Hono, SQLite) has seven open issues in `world/backlog/`, with planted trouble: a damage
charge that loses a cent, a double booking on a due date, a member search that leaks phone numbers, a
safety rule nobody wrote, and a request to change a protected folder. See [world/README.md](world/README.md).

![The library's desk view](images/catalogue.png)

```mermaid
flowchart LR
  subgraph World[The world]
    BL[world/backlog: 7 issues] 
    APP[world/app: lending app + tests]
  end
  subgraph Factory[What you build, one step at a time]
    F[Issue form] --> SZ[Sized backlog] --> SP[SPEC.md + pass list]
    SP --> CTX[AGENTS.md, path rule, triage skill]
    CTX --> RO[planner, builder in a worktree, reviewer]
    RO --> GA[deny rules, test-lock hook, Stop hook, ruleset]
    GA --> RUN[claude -p per stage, label workflow]
    RUN --> PR[roles by stage, spend cap, scorecard]
  end
  BL --> F
  RUN --> APP
  RUN --> RES[runs/issue/result.json + branch that passes the gate]
```

## How the course works

Start in [00-orientation](00-orientation/README.md). Each part opens with a problem at the library, a
public number from a real company, and a diagram. Each step has a challenge, a Done when list, and one
command, `bun run verify <step-name>`, that reads the files you produced and prints PASS or FAIL with what to
try next. You work in the Claude Code CLI; the checks read your files, never your chat.

| Part | Answers | Steps | Minutes |
|---|---|---|---|
| [0. Meet the library](parts/00-meet-the-library/README.md) | what are we building | `meet-the-library` | 15 |
| [1. Write the work order](parts/01-write-the-work-order/README.md) | does it know what done looks like | `write-the-issue-form`, `size-the-backlog`, `write-the-spec` | 50 |
| [2. Teach the repo](parts/02-teach-the-repo/README.md) | what must it know, what may it touch | `trim-the-agents-file`, `add-a-path-rule`, `package-the-triage-skill` | 45 |
| [3. Split the roles](parts/03-split-the-roles/README.md) | can it check its own work | `split-planner-and-builder`, `isolate-the-builder`, `build-the-reviewer`, `catch-the-planted-bug` | 65 |
| [4. Gate the agent](parts/04-gate-the-agent/README.md) | who has the last word | `deny-the-shortcuts`, `lock-the-tests`, `demand-proof-before-stop`, `protect-the-main-branch` | 60 |
| [5. Run it unattended](parts/05-run-it-unattended/README.md) | what stops it, where the result goes | `run-one-issue-headless`, `run-from-a-label`, `run-two-at-once` (elective) | 65 |
| [6. Price and ship](parts/06-price-and-ship/README.md) | what it cost, was it worth it | `route-models-by-stage`, `cap-the-spend`, `ship-the-factory` | 50 |

The same parts run as one long session, four shorter sessions, or a six-session cohort: see `schedules.toml`.
The build map for every part is in [PARTS.md](PARTS.md).

## The project

You ship the Northside factory in your own repo: your `.claude/`, `factory/` and `specs/`, the result
files of a run over all seven issues, and the scorecard. It is graded with yes or no questions a script
answers from git and the result files: at least 3 of issues 1 to 5 reach a draft pull request on a branch
whose tests pass the gate; no test file edited in the build; the reviewer blocked the planted off-by-one in
issue 3 and passed a clean diff; issue 6 refused; issue 7 stopped at the plan; every cost recorded and under
your cap; no key in any tracked file; a retro with one gate that fired and one change you will make.

## Claude Code, not the API

You work in the real Claude Code: the `claude` CLI in a terminal, Claude Code in your editor, or the Code tab
of Claude Desktop, signed in with your own Claude account. The course never calls the model API and never
asks for an API key. What you build is Claude Code configuration (`CLAUDE.md`, rules, settings, hooks, skills,
subagents) and the work Claude Code does with it. The checks read those files and what Claude Code produced
in the world (files, git history, result files), never a chat reply. Hooks are tested by feeding them the
JSON Claude Code sends on stdin. `config/claude-code.ts` holds the model alias per role, the headless flags,
and the oldest Claude Code version the course is tested on, 2.1.311.

```bash
bun run doctor
```

Expect: `doctor: ready, 4 of 4 required checks pass.` and a `Claude Code` line with your version and whether you are signed in.

## Read before you start

About 65 minutes of reading in all:

1. [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices), Anthropic. Read "Let
   Claude run without you": the five questions this course is built on.
2. [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents),
   Anthropic. The pass list you write in Part 1.
3. [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps),
   Anthropic. Why the reviewer is a separate agent that must show evidence.

## Checks for this repo

```bash
bun run check
```

Expect: `The repo meets the standard` and `Every check rejects its starter and wrong answers, and passes its solution.`

The rules every course repo follows are in [STANDARD.md](STANDARD.md).
