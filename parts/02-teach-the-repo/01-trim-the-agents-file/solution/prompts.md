# How Claude Code got here: trim the agents file

Claude Code cuts `AGENTS.md` from 120 lines to 19 and turns `CLAUDE.md` into one import. You check that the
lines only you know are still there. The files in this folder are what it wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Read AGENTS.md and CLAUDE.md. The app they describe is in ../../../../world/app. Make AGENTS.md short. Delete every line that you could learn by reading the repo yourself: the folder tree, what each folder holds, the tech stack, and general advice like "write clean code". Keep three headings: Commands, Protected paths and Done when. Keep bun run gate as the one gate, and keep src/auth/ as a protected path. Drop the Money section for now: the next step gives it a rule file of its own. Keep AGENTS.md under 80 lines, in short plain sentences. Then make CLAUDE.md one line: @AGENTS.md. Show me your plan before you change anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

````text
I haven't changed anything yet. Here's the plan.

## Plan

**Delete from AGENTS.md:**
- **Not instructions:** the welcome line, "About the library" and "Thank you".
- **Readable from the repo:** "Tech stack", "Folder layout", "What each folder holds" and "Important files". `world/app/README.md` already has the folder table.
- **General advice:** "How to write code", "Tests", "Git" and "Style". Style includes the Biome line, which isn't on your keep list, so it goes too.
- **Money:** dropped for now, since the next step gives it its own rule file.

**New AGENTS.md** (about 20 lines):
```markdown
# Instructions for agents

## Commands

- `bun install` installs the packages.
- `bun run app` starts the web app on port 3000.
- `bun run desk overdue` lists the overdue loans.
- `bun test` runs every test.
- `bun run gate` runs every test and records the result. It is the one gate.

## Protected paths

- Never edit anything in `src/auth/`.
- The roles there decide who may waive a fee. A coordinator reviews every change.

## Done when

- `bun run gate` passes on the code as it is now.
- You tell the person what you changed and why.
```

**New CLAUDE.md:**
```
@AGENTS.md
```

**How I'll check it:**
- `wc -l` will show AGENTS.md is under 80 lines and CLAUDE.md is one line.
- `grep '^## '` will show only the three headings.
- `grep` will confirm `bun run gate` and `src/auth/` are both still there.

**One thing to know:** I couldn't find a `package.json` in `world/` or `world/app/`, so I couldn't check that these `bun run` scripts exist. I kept the commands exactly as the old AGENTS.md lists them.

The plan is also saved at `/root/.claude/plans/read-agents-md-and-claude-md-vectorized-steele.md`. Tell me to go ahead, or what to change.
````

## What you check in the plan

- `bun run gate` is still under Commands, and it is still called the one gate.
- `src/auth/` is still under Protected paths. For example, `world/app/README.md` also says it is protected,
  but a README is not an instruction. Keep the line.
- The folder tree and "What each folder holds" are gone. Claude Code can list the folders itself.
- Claude Code says it could not find a `package.json` in `world/app`. That is true: the scripts live in the
  course's root `package.json`. Tell it where the app is, so it can check the paths are real.

## Prompt 2: approve, with your answers

```text
Go ahead. The app is in ../../../../world/app, so you can check that the commands and src/auth/ are real. Keep bun test: it is handy while you work. Drop the Biome and push lines. Then run bun run verify trim-the-agents-file and tell me what it prints.
```

Claude Code wrote the two files and ran the check. It printed `Done. All 8 rules pass.`

## What you reject

- A short file that still says where each folder is. The `wrong/folder-tree-kept/` answer shows it.
- A `CLAUDE.md` that copies the rules instead of importing them. Then a fix in one file misses the other.
  The `wrong/claude-md-copies-rules/` answer shows it.
- A file that drops Protected paths because the README already says it. The `wrong/protected-path-cut/`
  answer shows it.

```bash
bun run verify trim-the-agents-file solution
```

Expect: `Done. All 8 rules pass.`
