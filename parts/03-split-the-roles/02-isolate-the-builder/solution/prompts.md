# How Claude Code got here: isolate the builder

Claude Code adds one line to the builder, a `.gitignore` and a `.worktreeinclude`. You check that no secret
reaches the worktree. The files in this folder are what it wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Make the builder work in its own git worktree, so its edits never touch this checkout. Set isolation: worktree in .claude/agents/builder.md. Add .claude/worktrees/ to a .gitignore in this folder, so the worktree does not show up as untracked files. Write a .worktreeinclude that copies only .env.example into a new worktree, never .env or .env.local: the builder runs with nobody watching, and it must not get our secrets. Show me your plan before you change anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

```text
Nothing is changed yet. The plan is saved at `/root/.claude/plans/make-the-builder-work-eager-simon.md`. All three changes go in this folder, and nothing in `src/auth/` is touched.

1. **`.claude/agents/builder.md`**: add `isolation: worktree` to the frontmatter, after `model: sonnet`. The rest of the file stays as it is.
2. **New `.gitignore`**: one line, `.claude/worktrees/`.
3. **New `.worktreeinclude`**: lists only `.env.example`, plus a comment saying `.env` and `.env.local` must never be added. There's no `.env*` wildcard, so neither secrets file can match.

**`.env.example` gets copied anyway:** `.worktreeinclude` only copies files that git ignores. `.env.example` is committed, so every new worktree gets it from git regardless, and listing it just records the intent. What actually keeps the secrets out is that `.env` and `.env.local` are not listed. The repo-root `.gitignore` already ignores both, so they won't appear in a new worktree unless they're listed.

**Checks after the change:**
- `git check-ignore -v .claude/worktrees/x` should point to the new `.gitignore`.
- `git status` should show only `builder.md` changed and the two new files.
- If you want, I can start the builder on a small task to confirm it lands under `.claude/worktrees/`, gets no `.env` or `.env.local`, and leaves this checkout clean.
- `bun run gate`, as AGENTS.md requires.

Say go and I'll make these changes.
```

## What you check in the plan

- There is no `.env*` wildcard in `.worktreeinclude`. For example, `.env*` would also match `.env.local`.
- Claude Code points out that `.env.example` is tracked, so git copies it anyway. That is true. The line
  records what the builder may have. Leaving `.env` out is what keeps the secret out.
- Only `builder.md` changes. The planner does not edit, so it needs no worktree.

## Prompt 2: approve

```text
Go ahead. Then run bun run verify isolate-the-builder and tell me what it prints.
```

Claude Code asks before it writes under `.claude/`. Approve the write. It said:

````text
The builder is now set to run in its own git worktree, and `bun run verify isolate-the-builder` passes all 7 rules.

**What I changed** (all in this folder):
- **`.claude/agents/builder.md`**: added `isolation: worktree` to the frontmatter. The rest of the file is unchanged, so the builder keeps its Edit and Bash tools.
- **`.gitignore`** (new): contains `.claude/worktrees/`, so the builder's worktree doesn't show up as untracked files here.
- **`.worktreeinclude`** (new): lists only `.env.example`, with a comment that `.env` and `.env.local` must never be added. The builder runs with nobody watching, so it must not get the secrets.

`.env.example` is already committed, so every worktree gets it from git anyway. What actually keeps the secrets out is that `.env` and `.env.local` are not listed.

**What `bun run verify isolate-the-builder` printed:**
```
Checking isolate-the-builder (your work):
  PASS  builder.md sets isolation: worktree
  PASS  builder.md still has Edit and Bash
  PASS  .gitignore ignores .claude/worktrees/
  PASS  .worktreeinclude names .env.example
  PASS  a dry run copies no .env or .env.local into the builder's worktree
  PASS  while the worktree exists, the main checkout shows no untracked files
  PASS  the dry run removes the worktree and leaves one tree
Done. All 7 rules pass.
Progress: 1/6 steps pass.
```
"Progress: 1/6 steps pass" counts the course's steps as a whole, not this change.

**Not run:**
- **`bun run gate`:** I didn't run it, so the "Done when" rule in AGENTS.md isn't confirmed yet. My command was blocked pending approval because I had added output piping to it. Approve it or run `bun run gate` yourself to finish that step. I changed only configuration files, nothing under `src/`.
- **My two git checks:** `git check-ignore` and `git status` also needed approval, so I skipped them. The verify run tests the same things, ignoring `.claude/worktrees/` and keeping this checkout free of untracked files, and both passed.
````

## What you reject

- A `.worktreeinclude` that copies `.env`, like the docs' example. The `wrong/secrets-copied/` answer shows it.
- No `.gitignore` line, so the worktree shows up as untracked files. The `wrong/worktrees-not-ignored/`
  answer shows it.
- A builder with no `isolation`. It edits your checkout. The `wrong/no-isolation/` answer shows it.

```bash
bun run verify isolate-the-builder solution
```

Expect: `Done. All 7 rules pass.`
