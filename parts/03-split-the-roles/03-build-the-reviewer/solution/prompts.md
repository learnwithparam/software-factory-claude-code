# How Claude Code got here: build the reviewer

Claude Code writes a read-only reviewer with a JSON reply. Then three real runs pass the clean fix for
issue 3. The reviewer and the three transcripts in this folder come from those runs.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Make a third subagent, .claude/agents/reviewer.md. It reviews one change with fresh eyes and changes nothing. Its tools are Read, Grep and Glob only, with model: sonnet. I give it a diff file, such as diffs/issue-3-clean.diff, and the issue number. The app the diff changes is in ../../../../world/app, and the issues are in ../../../../world/backlog. It checks that the change does what the issue asks. It skips style. It may only block with evidence: the exact input that breaks the code, and what the code returns for it. It replies with JSON only, in this shape: {"verdict": "pass" or "block", "findings": [{"file": ..., "line": ..., "evidence": ...}]}. The line is a line number in the changed file. Use short plain sentences. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code 2.1.323 in plan mode.

````text
Here's my plan. I haven't written anything yet.

**One new file:** `.claude/agents/reviewer.md`. Nothing else changes, and nothing in `src/auth/` is touched.

**Frontmatter**, laid out like `planner.md`:
```
---
name: reviewer
description: Reviews one diff against one backlog issue and changes nothing. Give it a diff file and an issue number. It replies with JSON only.
tools: Read, Grep, Glob
model: sonnet
---
```

**What the body tells the reviewer**, in short plain sentences:
1. You only read. Do not change any file. Do not run commands.
2. Read the diff file you are given, such as `diffs/issue-3-clean.diff`.
3. Find the issue with Glob on `../../../../world/backlog/<number>-*.md` and read it.
4. Read each changed file in `../../../../world/app/` to see the code around the change. That code is from before the diff, so apply the diff in your head.
5. Check one thing: does the change do what the issue asks? Work through the changed code by hand, using inputs from the issue and edge cases such as equal values, swapped arguments and boundaries.
6. Skip style, naming, comments and formatting.
7. Block only with evidence: the exact input, what the code returns for it, and what the issue says it should return. A doubt or a guess is not a finding. With no findings, the verdict is `pass` and `findings` is `[]`.
8. `line` is the line number in the changed file after the diff is applied. Count it from the `+` side of the hunk header.
9. Reply with JSON only, with no prose and no code fence: `{"verdict": "pass" | "block", "findings": [{"file", "line", "evidence"}]}`. I'll include one example reply in the file.

**What it should find on your two sample diffs** (I won't put these answers in the agent file):
- `issue-3-clean.diff` should pass.
- `issue-3-offbyone.diff` should block. The input `overlaps({from:"2026-03-13",to:"2026-03-15"}, {from:"2026-03-01",to:"2026-03-13"})` returns `false`, and the issue says the bookings clash. The finding is at `src/loans/reserve.ts` line 9.

**How I'll check it:** I'll run the reviewer on both diffs with issue 3 and confirm it gives those results. Then I'll run `bun run gate` and tell you what I changed.

The plan is also saved at `/root/.claude/plans/make-a-third-subagent-fuzzy-octopus.md`. Tell me to go ahead, or what to change.
````

## What you check in the plan

- The tools are Read, Grep and Glob. The reviewer can read the app but cannot fix what it finds.
- A doubt is not a finding. For example, "the dates might be wrong" cannot block. "A booking from
  2026-03-13 and one that ends on 2026-03-13 do not clash" can.
- The reply is JSON only, so a script can read the verdict.

## Prompt 2: approve

```text
Go ahead.
```

Claude Code asks before it writes under `.claude/`. Approve the write. It said:

```text
I added the reviewer subagent at `.claude/agents/reviewer.md`. It worked on both sample diffs, but `bun run gate` is still not run, so the task isn't done yet.

**What's in the file**
- The frontmatter uses the same layout as the planner: `tools: Read, Grep, Glob` and `model: sonnet`.
- It reads the diff and the issue from `../../../../world/backlog`. It then reads the changed files in `../../../../world/app` and checks only whether the change does what the issue asks. It skips style.
- It may block only with evidence: the exact input that breaks the code, what the code returns for it, and what the issue says it should return. A doubt or a guess is not enough.
- `line` is the line number in the changed file after the diff is applied. The file explains how to count it from the hunk header.
- It replies with JSON only, with no text around it. The file shows one example pass and one example block.
- No other file changed, and nothing in `src/auth/` was touched.

**Test runs**
This session loaded its agents before the new file existed, so I couldn't call `reviewer` by name yet. Instead I gave the file's instructions to a general-purpose agent, which has more tools than the reviewer will. Both results matched the plan:
- **`issue-3-clean.diff`:** it replied `{"verdict": "pass", "findings": []}`.
- **`issue-3-offbyone.diff`:** it replied `block`, for `src/loans/reserve.ts` line 9. Its evidence was that `overlaps({from:"2026-03-13",to:"2026-03-15"}, {from:"2026-03-01",to:"2026-03-13"})` returns `false`, but the issue says the 13th is taken. It also found that two one-day bookings on the same date return `false`.

**Gate**
`bun run gate` needs your approval, and I couldn't get it here. Please approve it or run it yourself. Since I added only a markdown file under `.claude/`, I don't expect it to change the result. Starting a new session will register `reviewer`, so you can then call it by name.

**One thing to check:** the example block in the file uses a made-up `split(1000, 3)` case. It looks like issue 2 ("split loses a cent"), so it could lead the reviewer when it works on issue 2. I can swap it for an unrelated example if you'd like.
```

Claude Code offers to swap the example in the file, which looks like issue 2. You can say yes. The example
only shows the shape of the reply.

## The three runs

Type `/exit`, then run the reviewer three times from this folder:

```bash
mkdir -p runs/review-clean && for run in 1 2 3; do claude -p "Review the change in diffs/issue-3-clean.diff for issue 3." --agent reviewer --add-dir ../../../../world --output-format stream-json --verbose --setting-sources project,local --no-session-persistence > runs/review-clean/run-$run.jsonl; done
```

Expect: no output, and three files in `runs/review-clean/`.

All three runs passed the clean fix. Run 1 replied:

```text
{"verdict": "pass", "findings": []}
```

## What you reject

- A reviewer that only checks for a test. The `wrong/trusts-the-tests/` answer shows it.
- A reviewer that may run any command. The `wrong/reviewer-can-run-anything/` answer shows it.
- A reply in free prose. The `wrong/free-text-reply/` answer shows it.

```bash
bun run verify build-the-reviewer solution
```

Expect: `Done. All 7 rules pass.`
