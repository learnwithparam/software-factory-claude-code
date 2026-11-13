# How Claude Code got here: demand proof before stop

Claude Code writes a Stop hook that holds the builder until the gate passed on the code as it is now. You
check the four cases. The hook and settings in this folder are the files it wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Write a Stop hook at .claude/hooks/stop-gate.ts and register it under hooks.Stop in .claude/settings.json, run with bun. In a factory run the app sits at the project root, and bun run gate writes .factory/gate.json with exit_code and tree, a hash of src/ and tests/. Read ../../../../world/gate.ts to see how it makes that hash. When FACTORY_STAGE is build, the hook must not let you stop until the gate passed on the code as it is now. Block the stop when gate.json is missing, when exit_code is not 0, or when its tree differs from a fresh hash of src/ and tests/. To block, print JSON with decision block and a reason that says what to do next. If stop_hook_active is true in the event, always allow the stop, so it can never loop. Find the project with CLAUDE_PROJECT_DIR. Keep the deny list and the lock-tests hook as they are. Use whole-word names and short functions. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code 2.1.323 in plan mode.

```text
Here's my plan. I haven't written anything yet. It's also saved at `/root/.claude/plans/write-a-stop-hook-gentle-locket.md`.

**What changes**
- **New file:** `.claude/hooks/stop-gate.ts`
- **Edit:** `.claude/settings.json`. I'll add only `hooks.Stop`, running `bun "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-gate.ts"`. The deny list and the lock-tests `PreToolUse` hook stay exactly as they are.

**The hash**
The hook will copy the hash logic from `world/gate.ts` instead of importing it, because in a factory run the `world/` folder may not be next to the app. It has to produce exactly the same hash:
- sha256 over `src/` and then `tests/`, walked recursively
- each folder's entries sorted with plain `.sort()`
- for each file, hash its path relative to the project root, then its bytes
- skip a folder that doesn't exist
- keep the first 12 hex characters

**Functions in the hook** (short, whole-word names, same style as `lock-tests.ts`)
- `readEvent`: reads the event from stdin
- `projectDir`: uses `CLAUDE_PROJECT_DIR`, falling back to the current folder
- `addFolderToHash` and `treeHash`: the copied hash logic
- `readRecord`: reads `.factory/gate.json`, or returns null if it's missing or unreadable
- `blockReason`: decides whether to block, and why
- `block`: prints `{"decision":"block","reason":…}` and exits 0
- `main`

**What `main` does**
1. If `FACTORY_STAGE` isn't `build`, allow the stop.
2. If `stop_hook_active` is true, allow the stop, so it can never loop.
3. Otherwise block in three cases, each with a reason that says what to do next:
   - **gate.json is missing:** "Run `bun run gate` and fix any failures before stopping."
   - **`exit_code` isn't 0:** "Fix the code under src/ until `bun run gate` passes, then stop."
   - **`tree` doesn't match a fresh hash:** "src/ or tests/ changed since the last gate (tree X, now Y). Run `bun run gate` again."

**How I'll check it**
I'll make a scratch project with passing tests and send test events to the hook:
- It blocks when gate.json is missing.
- After a real `world/gate.ts --record` run, it allows the stop. This also proves my copied hash matches the gate's.
- It blocks after I edit a file in `src/`.
- It blocks when gate.json has `exit_code` 1.
- It always allows when `stop_hook_active` is true, or when `FACTORY_STAGE` isn't set.
- `settings.json` is still valid JSON, and `git diff` shows the deny list and lock-tests entry unchanged.

Say go and I'll write it.
```

## What you check in the plan

- The hash walks `src/` then `tests/`, sorted, path then bytes, like `world/gate.ts`. For example, a hash
  in another order never matches, and the hook blocks forever.
- `stop_hook_active` is checked before anything else, so a second stop always goes through.
- It finds the project with `CLAUDE_PROJECT_DIR`, not the folder the shell happens to be in.
- The deny list and the lock-tests hook stay as they are.

## Prompt 2: approve

```text
Go ahead. Then run bun run verify demand-proof-before-stop and tell me what it prints.
```

In the recorded run nobody was there to approve the writes under `.claude/`, so it stopped:

```text
I haven't written anything yet. Both writes were blocked at the permission prompt:

- **`.claude/hooks/stop-gate.ts`** was flagged as a sensitive file. Everything under `.claude/` gets this treatment.
- **`.claude/settings.json`** was also blocked because permission hasn't been granted.

I didn't try to get around the prompts with shell commands, since that would sidestep your permission settings. I also haven't run `bun run verify demand-proof-before-stop`. Without the hook in place, its output wouldn't tell you anything about the hook.

The code is ready and follows the plan. To go ahead, either:

1. Approve the two edits when the prompts appear and tell me to retry.
2. Or allow edits to `.claude/**` for this session, for example by switching to accept-edits mode.

Once the files are written, I'll run the scratch-project checks and then `bun run verify demand-proof-before-stop`, and tell you exactly what it prints.
```

## Prompt 3: get the files

```text
The writes to .claude/ were not approved in this session. Print the full final content of .claude/hooks/stop-gate.ts and of .claude/settings.json, each in one code block, so I can save them myself. Print nothing else in those blocks.
```

Claude Code printed both files. They are saved here word for word, except that two long lines were split
to fit 100 characters. When you run it yourself, approve the two writes instead.

## What you reject

- A hook that ignores `stop_hook_active`. It can hold Claude Code in a loop. The `wrong/loops-forever/`
  answer shows it.
- A hook that trusts any passing record, even one from older code. The `wrong/trusts-any-record/` answer
  shows it.

```bash
bun run verify demand-proof-before-stop solution
```

Expect: `Done. All 7 rules pass.`
