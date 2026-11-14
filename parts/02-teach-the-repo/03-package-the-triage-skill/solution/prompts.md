# How Claude Code got here: package the triage skill

Claude Code writes a read-only skill with a fixed reply. Then three real runs of `/triage 6` refuse the
issue. The skill and the three transcripts in this folder come from those runs.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Write a skill at .claude/skills/triage/SKILL.md that decides if one backlog issue is safe for the factory to start. I run it as /triage 6, where 6 is the issue number. The issues are files in ../../../../world/backlog, named like 6-volunteers-waive-fees.md. The app is in ../../../../world/app. The skill reads the issue and finds the files the change would touch. It refuses any issue that needs a change in src/auth/, the protected path in AGENTS.md. The skill only reads: set allowed-tools to Read, Grep and Glob, and set disallowed-tools to Edit and Write. End the skill with a fixed reply of four lines: TYPE: bug, feature, docs or deps. RISK: low, medium or high. FILES: the files it would touch. DECISION: proceed or refuse, then the reason. Use short plain sentences. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

````text
I haven't written anything yet. The plan is below. I can't find the tool that formally ends plan mode, so I'm showing it here and waiting for your go-ahead.

## Plan: `/triage <n>` skill

I'll create one file: `problem/.claude/skills/triage/SKILL.md`. No other file changes, and nothing in `src/auth/`.

**Frontmatter**
```yaml
---
name: triage
description: Decide if one backlog issue is safe for the factory to start. Use as /triage <number>.
argument-hint: <issue-number>
allowed-tools: Read, Grep, Glob
disallowed-tools: Edit, Write
---
```

**Steps in the skill**
1. `$ARGUMENTS` is the issue number. If it is missing or not a number, refuse.
2. Look for `../../../../world/backlog/$ARGUMENTS-*.md` and read it. If there is no match, refuse.
3. Find the files. Start with any paths the issue names. Then search `world/app/src` and `world/app/tests` for the words and commands in the issue, and read the likely files to confirm. Paths are written from the app folder, like `src/fees/split.ts`.
4. **Type:** bug, feature, docs or deps. The issue labels are a hint.
5. **Risk:** high for money, privacy, safety, auth or a major upgrade. Medium for a logic bug in one place. Low for docs only.
6. If any file is under `src/auth/`, refuse, even when the issue asks for that change.
7. Refuse if the touched files can't be found.
8. Never edit a file and never run a command.
9. Reply with exactly four lines and nothing else:
   ```
   TYPE: <bug|feature|docs|deps>
   RISK: <low|medium|high>
   FILES: <comma-separated paths, or none>
   DECISION: <proceed|refuse> - <one-sentence reason>
   ```

**One choice for you:** the factory's own triage prompt (`world/finished/stages/triage.md`) has a third decision, `plan_only`, for major upgrades like issue 7. You asked for only proceed or refuse, so I'll keep those two. Issue 7 would get high risk and proceed, with a reason that says a person should decide. I can add `plan_only` instead if you want it.

**How I'll check it**
- `/triage 6` should refuse and name `src/auth/roles.ts`.
- `/triage 1` should proceed.
- `bun run gate` should still pass, since no app code changes.

Shall I write it?
````

## What you check in the plan

- `allowed-tools` is Read, Grep and Glob, and `disallowed-tools` is Edit and Write. For example, a skill with
  only `allowed-tools` can still edit a file: that field skips the question, it forbids nothing.
- The `src/auth/` rule holds "even when the issue asks for that change". Issue 6 asks for exactly that.
- Claude Code asks about `plan_only` for issue 7. Two decisions are enough for this step. The "Run it unattended" part uses the
  finished factory's triage, which has the third one.

## Prompt 2: approve

```text
Go ahead.
```

Claude Code asks before it writes under `.claude/`. Approve the write. It wrote `SKILL.md` and said:

```text
I wrote the skill at `.claude/skills/triage/SKILL.md`, but I haven't run it yet. Both the test run and `bun run gate` need your approval in this sandbox.

**What's in it**
- **Frontmatter:** `allowed-tools: Read, Grep, Glob` and `disallowed-tools: Edit, Write`, with `argument-hint: <issue-number>` so you call it as `/triage 6`.
- **Steps:**
  1. Check the number and find the matching file in `../../../../world/backlog/`.
  2. Read the issue.
  3. Search `world/app/src` and `world/app/tests` for the files the change would touch.
  4. Pick the type and the risk.
  5. Refuse if any of those files is under `src/auth/`, even when the issue asks for it, because AGENTS.md protects that path.
  6. It also refuses if the issue or the files can't be found, and it says not to run commands.
- **Reply:** exactly four lines: `TYPE`, `RISK`, `FILES` and `DECISION: proceed|refuse - reason`.
- **Major upgrades:** as we agreed, there are only two decisions. For a major upgrade like issue 7 the decision is proceed, and the reason says a person should decide.

**What I checked:** the skill's relative paths work from this folder. `../../../../world/backlog/6-volunteers-waive-fees.md` and `1-readme-run-it.md` both exist.

**To finish:**
- `claude -p "/triage 6"` in this folder should end with `DECISION: refuse` and list `src/auth/roles.ts`.
- `claude -p "/triage 1"` should proceed.
- `bun run gate` in `world/` should still pass, since no app code changed.

If you approve those commands, I'll run them and report the results.
```

## The three runs

Type `/exit`, then run the skill three times from this folder:

```bash
mkdir -p runs/triage-6 && for run in 1 2 3; do claude -p "/triage 6" --add-dir ../../../../world --output-format stream-json --verbose --setting-sources project,local --no-session-persistence > runs/triage-6/run-$run.jsonl; done
```

Expect: no output, and three files in `runs/triage-6/`.

All three runs refused. The reply of run 1 was:

```text
TYPE: feature
RISK: high
FILES: src/auth/roles.ts
DECISION: refuse - The change touches src/auth/, which AGENTS.md protects because only coordinators may change who can waive fees.
```

## What you reject

- A skill with `allowed-tools` and no `disallowed-tools`. The `wrong/allowed-tools-only/` answer shows it.
- A skill that may edit files. The `wrong/can-edit-files/` answer shows it.
- A reply in free prose. No script can read it. The `wrong/no-reply-contract/` answer shows it.

```bash
bun run verify package-the-triage-skill solution
```

Expect: `Done. All 8 rules pass.`
