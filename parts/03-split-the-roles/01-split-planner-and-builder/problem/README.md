# Split the planner and the builder

## The problem

One agent that reads, plans, edits and runs commands can change anything while it is still thinking.
For example, issue 3 is about one function, `overlaps` in `src/loans/reserve.ts`. An agent with every tool may
start editing before it has found that function.

So the factory splits the work. A **planner** may only read, and it writes a plan. A **builder** may edit
files and run commands, and it carries out the plan.

```mermaid
flowchart LR
  I[issue 3] --> P[planner: Read, Grep, Glob] --> PL["plan: ## Files, ## Steps"]
  PL --> B[builder: Edit, Write, Bash] --> C[code change, bun run gate]
```

## Your challenge

Get Claude Code to write two subagents in `.claude/agents/` in this folder. A subagent is a Markdown file
with a `tools` list, a `model` and a prompt. Then run the planner three times on issue 3.

Start Claude Code in this folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

Type this prompt:

```text
Make two subagents in .claude/agents/. The first is planner.md. It plans one issue and changes nothing. Its tools are Read, Grep and Glob only: no Edit, no Write, no Bash. Set model: sonnet. It reads the issue in ../../../../world/backlog and the app in ../../../../world/app. It replies with a plan in two sections. Under ## Files, one app path per line, written from the app folder like src/loans/reserve.ts, with (new) after a file that does not exist yet. Under ## Steps, numbered steps. The second is builder.md. It carries out a plan. Its tools are Read, Grep, Glob, Edit, Write and Bash, with model: sonnet. It changes code under src/ until bun run gate passes, and it never edits src/auth/. Use short plain sentences. Show me your plan before you write anything.
```

Read the plan. The planner's `tools` line must have no Edit, Write or Bash. Approve it, then type `/exit`.
Now run the whole session as the planner, three times:

```bash
mkdir -p runs/planner-3 && for run in 1 2 3; do claude -p "Plan issue 3." --agent planner --add-dir ../../../../world --output-format stream-json --verbose --setting-sources project,local --no-session-persistence > runs/planner-3/run-$run.jsonl; done
```

Expect: no output. `runs/planner-3/` then holds three `.jsonl` files.

## Done when

- `planner.md` lists only reading tools and sets a `model`.
- `planner.md` asks for `## Files` and `## Steps`.
- `builder.md` has Edit and Bash.
- Three real runs ran as the planner and changed nothing.
- In at least two, the plan names `src/loans/reserve.ts`, and every file exists or says `(new)`.

```bash
bun run verify split-planner-and-builder
```

Expect: `Done. All 8 rules pass.`

## If you get stuck

| What you see                              | What to do                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| `FAIL  planner.md lists its tools ...`    | Tell Claude Code: "Set tools: Read, Grep, Glob in planner.md." |
| `FAIL  runs/planner-3/ holds 3 real ...`  | Run the `claude -p --agent planner` command above.             |
| `FAIL  ... every planned file exists ...` | Tell Claude Code: "The planner checks each path with Glob."    |

The prompts, the plan and a real planner reply are in `../solution/prompts.md`.

## Words you will use

- **Subagent**: a Markdown file in `.claude/agents/`. It gives one job its own tools, model and prompt.
- **tools**: the only tools the subagent gets. With no `tools` line, it gets every tool.
- **--agent**: runs the whole session as that subagent, with its tools and model.
- **Plan**: the planner's reply. It names the files and the steps, and changes nothing.
