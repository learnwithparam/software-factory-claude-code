# Start here

You will set up the repo, meet the library, run the finished factory, and see the goal. Then you pass the
first step, `meet-the-library`. No API key is needed for any of it.

You work in two places: a terminal for the commands below, and the Claude Code CLI (`claude`) from Part 1 on.

## 1. Set up

```bash
bun install
```

Expect: `bun install` ends with no errors.

```bash
bun run world
```

Expect: `world: Northside Tool Library is ready: 12 tools, 8 members, 4 loans out (1 overdue), 7 open issues.`

```bash
bun run doctor
```

Expect: `doctor: ready for replay, 4 of 4 required checks pass.` The `Live runs:` part says `ready` once
Claude Code is installed. You need it from Part 1 on.

```bash
bun run models
```

Expect: `models: every role answers on replay.` To run live later, copy `.env.example` to `.env`, set
`LLM_PROVIDER` and one key, and run it again.

## 2. Meet the library

```bash
bun run app
```

Expect: `app: Northside Tool Library is open at http://localhost:3000`. Open it in a browser, then stop it with Ctrl+C.

![The library's desk view: the catalogue with a class C chainsaw, and one overdue loan in red](images/catalogue.png)

```bash
bun run desk split D-301
```

Expect: `desk: charge £33.33, shares add up to £33.32`. A penny goes missing. That is issue 2.

Read the seven issues in `world/backlog/`, and [world/README.md](../world/README.md) for the data and the rules.

## 3. Run the finished factory

```bash
bun run factory:replay 2
```

Expect: `replay: issue 2 ended in draft_pr.` with one `BLOCKED` line in red.

![The finished factory replaying issue 2](images/replay-issue-2.png)

Read it stage by stage. The model replies are recorded, but the rest is real: the spec stage adds a failing
test, the builder tries to change that test, the hook blocks it, the builder fixes the code, and the gate
runs the app's tests on the result.

## 4. See the goal

```bash
bun run scorecard
```

Expect: `scorecard: 0 of 6 targets met. You have no runs yet; the replay does not count.`

These are the targets your own factory must meet at the end of the course.

## 5. Pass the first step

Open [the first step](../parts/00-meet-the-library/01-meet-the-library/problem/README.md), write your one
line in its `notes/goal.md`, then:

```bash
bun run verify meet-the-library
```

Expect: `Done. All 5 rules pass.` and a `Progress:` line.

When a command prints something you do not expect, look it up in [troubleshooting.md](troubleshooting.md).
