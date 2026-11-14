# Start here

You will install Claude Code and sign in, set up the repo, meet the library, run the finished factory, and
see the goal. Then you pass the first step, `meet-the-library`.

You do the work of this course in the real Claude Code. You can use it in three places:

- the `claude` CLI in a terminal, the window where you type commands (the commands below use this);
- Claude Code in VS Code or a JetBrains editor;
- the Code tab of Claude Desktop.

You never write code by hand in this course. You type a prompt, read the plan Claude Code shows, say yes
or no, and check the result. For example, in the first step you ask Claude Code which issue a factory
would get wrong. Then you ask it to save your own answer in a file.

You sign in with your own Claude account: a Pro or Max plan, or a Console account. The free plan does not
include Claude Code. No step asks for an API key, and nothing in this repo calls the model API.

## 1. Set up

Install Claude Code with the official installer (macOS, Linux and WSL; on Windows, use WSL2 for this course):

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Expect: the installer ends with no error. Open a new terminal so `claude` is on your PATH.

```bash
claude --version
```

Expect: a version number, then the words Claude Code. Run
`claude update` if the doctor says yours is too old.

Sign in once. Start `claude`, type `/login`, and follow the browser prompts with your Claude account. Then
type `/exit`.

```bash
claude auth status
```

Expect: JSON with `"loggedIn": true`.

Get the course folder, if you do not have it yet, and open it in your terminal:

```bash
git clone https://github.com/learnwithparam/software-factory-claude-code && cd software-factory-claude-code
```

Expect: your prompt is now inside the `software-factory-claude-code` folder.

Install Bun, which runs the course scripts, then open a new terminal in the same folder:

```bash
curl -fsSL https://bun.sh/install | bash
```

Expect: the installer ends with no error, and `bun --version` prints 1.4 or newer.

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

Expect: `doctor: ready, 4 of 4 required checks pass. Claude Code: ready for live runs.` The doctor asks
`claude` itself for its version and sign-in. Is Claude Code missing or signed out? Then the line ends `not
ready yet, so the finished factory replays its recorded runs`. The course still works, and the `--` lines
say what to do.

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
bun run finished 2
```

Expect: `finished: issue 2 ended in draft_pr.` The first line says whether it runs live or replays.

![The finished factory on issue 2](images/replay-issue-2.png)

Read it stage by stage. Each stage is one `claude -p` run in a fresh copy of the app, with the factory's own
`CLAUDE.md`, settings and hooks. Triage reads the issue and decides. The spec stage writes
`specs/2/SPEC.md` and tests that fail on purpose. The build stage changes `src/` until `bun run gate` passes.
A hook locks the tests. A Stop hook will not let it finish until the gate passes on the code as it is. The review stage reads the change in a fresh context and returns pass or block. Lines that start
with `denied:` are Claude Code's permission rules at work: each stage may only run the commands it needs.

Live, it uses your Claude plan, and the last line shows the cost Claude Code estimated for the run. With
`--replay` it uses nothing: it replays a real run recorded in `world/recordings/issue-2/`, and the gate and the hooks still run
here for real. Look at what the run left behind in `runs/finished-2/`: the app copy in `repo/` with one
commit per stage, the transcripts, and `result.json`.

## 4. See the goal

```bash
bun run scorecard
```

Expect: `scorecard: 0 of 6 targets met. You have no runs yet; the replay does not count.`

These are the targets your own factory must meet at the end of the course.

## 5. Pass the first step

The [ways of working](ways-of-working.md) page lists the Claude Code techniques the course teaches.

Open [the first step](../parts/00-meet-the-library/01-meet-the-library/problem/README.md). Follow its
prompts: Claude Code reads the issues, you choose one, and Claude Code saves your line in its
`notes/goal.md`. Then ask Claude Code to check your work. Type:

```text
Run `bun run verify meet-the-library` and tell me what it printed. Do not change anything to make it pass.
```

The raw command is:

```bash
bun run verify meet-the-library
```

Expect: `Done. All 5 rules pass.` and a `Progress:` line.

When a command prints something you do not expect, look it up in [troubleshooting.md](troubleshooting.md).
