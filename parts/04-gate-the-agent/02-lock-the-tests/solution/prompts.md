# How Claude Code got here: lock the tests

Claude Code writes a hook that blocks test edits in the build stage, and registers it. You check how it
blocks and what it lets through. The hook and settings in this folder are the files it wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Write a PreToolUse hook at .claude/hooks/lock-tests.ts and register it in .claude/settings.json with the matcher Edit|Write|Bash, run with bun. When the FACTORY_STAGE environment variable is build, the hook blocks any change to a test file: an Edit or Write of a file under tests/ or named *.test.ts, and a Bash command that writes to one, like sed -i, a > redirect, mv, cp or rm. To block, it exits 2 and prints a reason on stderr that tells you to change the code under src/ and leave the test alone. In every other stage, and for every other file, it allows the call. Keep the deny list as it is. Claude Code sends the event as JSON on stdin; read the hooks guide in the Claude Code docs for its shape. Use whole-word names and short functions. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

````text
Nothing is written yet; this is the plan. The project currently holds only a README, CLAUDE.md and `.claude/settings.json`. The plan is also saved at `/root/.claude/plans/write-a-pretooluse-hook-hazy-sun.md`.

**Files**
1. A new file, `.claude/hooks/lock-tests.ts`, run with bun and with no dependencies.
2. In `.claude/settings.json`, add a `hooks` block. The `permissions` allow and deny lists stay exactly as they are.

**What Claude Code sends on stdin** (from the hooks guide): `{ hook_event_name, tool_name, tool_input, cwd, ... }`. For Edit and Write the path is in `tool_input.file_path`; for Bash the command is in `tool_input.command`. Exit 0 lets the call through. Exit 2 blocks it, and whatever the hook printed on stderr goes back to Claude as the reason.

**The hook's functions**
- `readEvent()`: reads the event with `await Bun.stdin.json()`. If the JSON doesn't parse, it returns null and the call is allowed.
- `isTestPath(path)`: true if the path ends in `.test.ts` or has a `tests/` folder in it. It also handles a relative path that starts with `tests/`.
- `editTouchesTest(input)`: true if `tool_input.file_path` is a test path.
- `commandTouchesTest(command)`: splits the command into words. It returns true only if one of the words is a test path **and** the command writes:
  - `sed -i` (or `-i.bak`, `--in-place`)
  - a `>` or `>>` redirect into the test file
  - one of `mv`, `cp`, `rm`, `tee`, `truncate`, `touch`, `dd of=`, `perl -i` or `ln`

  So `cat tests/x.test.ts` and `bun test` still run.
- `block(path)`: prints this on stderr and exits 2: *"Blocked: tests are locked in the build stage. Do not change `<path>`. Change the code under src/ so the test passes, and leave the test alone."*
- `main()`: exits 0 unless `FACTORY_STAGE` is `build`. Otherwise it picks the check by `tool_name` (Edit/Write or Bash), then blocks or allows.

**Registration in `settings.json`**
```json
"hooks": { "PreToolUse": [ { "matcher": "Edit|Write|Bash",
  "hooks": [ { "type": "command",
    "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/lock-tests.ts\"" } ] } ] }
```

**How I'll check it**: I'll pipe sample events into the hook and check what it returns.
- With `FACTORY_STAGE=build`:
  - Should block (exit 2): writing `tests/loan.test.ts`, editing `src/foo.test.ts`, `sed -i … tests/x.ts`, `echo > tests/a.test.ts`, `mv a.test.ts b.ts`, `rm tests/x`.
  - Should allow (exit 0): editing `src/loan.ts`, `cat tests/x.test.ts`, `bun test`.
- With any other stage, or none set, every one of those cases should exit 0, and so should bad JSON.
- On a block, stderr should carry the reason.
- `git diff` should show the deny list unchanged and `settings.json` still valid JSON.

A finished reference version of this hook exists under `world/finished/factory/`. I haven't read it and will write my own unless you want me to match it.

Say go and I'll write it.
````

## What you check in the plan

- It blocks with exit 2 and a reason on stderr. For example, a hook that exits 1 only shows an error, and the
  edit still happens.
- It checks `FACTORY_STAGE` first, so the spec stage can still write tests.
- `bun test` and `cat` on a test file stay allowed. Reading a test is not changing it.
- Claude Code names the limit itself: a pattern match can be dodged. That is why the "Gate the agent" part has a Stop hook and
  a required check after this wall.

## Prompt 2: approve

```text
Go ahead. Then run bun run verify lock-the-tests and tell me what it prints.
```

Claude Code asks before it writes under `.claude/`, because hooks and settings change what it may do. In the
recorded run nobody was there to approve, so it stopped:

````text
I haven't written either file yet. Claude Code stopped both writes for permission:

- `.claude/hooks/lock-tests.ts` is under `.claude/`, which Claude Code treats as a sensitive file.
- The edit to `.claude/settings.json` needs your approval, and it hasn't been given.

I didn't try to get around this through the shell. The hook is what keeps the tests locked, so changing the settings that control it should go through your approval.

I ran the verify command anyway. Because nothing was written, it checked the project as it is now:

```
$ bun scripts/verify.ts lock-the-tests
Checking lock-the-tests (your work):
  FAIL  settings.json registers a PreToolUse command hook for Edit, Write and Bash
  FAIL  in the build stage, the recorded Edit of tests/fees/split.test.ts is blocked
  FAIL  the block reason tells Claude Code to change the code instead
  FAIL  in the build stage, a shell write to a test file is blocked: sed -i 's/1667/1666/' tests/fees/split.test.ts
  PASS  in the spec stage, the same test edit is allowed: the spec writes the tests
  PASS  in the build stage, editing src/fees/split.ts and running bun run gate are allowed
  PASS  the deny rules from deny-the-shortcuts are still there
3 of 7 rules pass. Fix the FAIL lines and run it again.
Progress: 0/6 steps pass.
error: script "verify" exited with code 1
```

All 4 failures come from the hook not being there. The 3 passes are the cases where the right behaviour is to allow the call.

The hook code is ready, written the way the plan describes. Approve the two writes, either at the prompt or by allowing edits to `.claude/` in your permission mode. Then tell me to retry and I'll write both files, rerun the verifier and report what it prints.
````

## Prompt 3: get the files

```text
The writes to .claude/ were not approved in this session. Print the full final content of .claude/hooks/lock-tests.ts and of .claude/settings.json, each in one code block, so I can save them myself. Print nothing else in those blocks.
```

Claude Code printed both files. They are saved in this folder word for word, with one change:
`bun run format` lined them up, and a comment tells the readability check that `tool_name` is Claude
Code's own name. When you run it yourself, approve the two writes instead.

## What you reject

- A hook that exits 1 to block. The `wrong/exit-one/` answer shows it.
- A hook that ignores the stage, so the spec stage cannot write its tests. The `wrong/blocks-every-stage/`
  answer shows it.
- A matcher of `Edit|Write` only, so `sed -i` in Bash gets through. The `wrong/misses-shell-writes/` answer
  shows it.

```bash
bun run verify lock-the-tests solution
```

Expect: `Done. All 7 rules pass.`
