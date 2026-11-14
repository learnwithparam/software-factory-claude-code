# How Claude Code got here: deny the shortcuts

Claude Code turns three requests in `CLAUDE.md` into deny rules. You check that each shortcut is caught in
every form, and that everyday work still runs. The settings file in this folder holds the rules it wrote.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
CLAUDE.md asks you never to force push, never to skip git hooks with --no-verify, and never to read .env. A request can be missed, so make each one a deny rule in .claude/settings.json under permissions.deny. Deny a force push written both as --force and as -f. Deny --no-verify anywhere in a command, on git commit and on git push. Deny reading .env and every .env file, like .env.local. Keep the allow list as it is. Do not deny everyday work: bun test, bun run gate, git diff and a normal git commit must still work. Read the permission rule syntax in the Claude Code docs if you need to. Show me your plan before you change anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

````text
Here's my plan. I haven't changed anything yet. The only file I'll edit is `.claude/settings.json`. The `allow` list stays exactly as it is, and I'll add this `deny` list next to it:

```json
"deny": [
  "Bash(git push --force*)",
  "Bash(git push * --force*)",
  "Bash(git push -f*)",
  "Bash(git push * -f*)",

  "Bash(git commit *--no-verify*)",
  "Bash(git push *--no-verify*)",
  "Bash(git commit -n*)",
  "Bash(git commit * -n*)",

  "Read(**/.env)",
  "Read(**/.env.*)"
]
```

- **Force push:** blocks `--force` and `-f`, whether the flag comes right after `push` or after the remote and branch (`git push origin main -f`). It also blocks `--force-with-lease`, which is still a force push.
- **`--no-verify`:** blocks the flag anywhere in a `git commit` or `git push` command. I'm also blocking `git commit -n`, because `-n` is git's short form of `--no-verify` for commit. `git push -n` is a dry run, so I'm leaving that alone.
- **`.env`:** blocks reading `.env`, `.env.local`, `.env.production` and so on, in any folder. It also blocks `.env.example`, since you asked for every `.env` file.
- **Still allowed:** `bun test`, `bun run gate`, `git diff`, `git status`, a normal `git commit -m "..."` and a normal `git push` don't match any of these rules.

**Gaps I'll leave unless you say otherwise:**
- The `Read` rules only stop Claude's file-reading tool. A shell command like `cat .env` can still read the file. I can add rules for `cat`, `head` and `grep` on `.env`, but no list of rules catches every command.
- The `git commit * -n*` rule will also block a commit whose message contains ` -n`, such as `-m "fix -n flag"`. That should be rare, and rewording the message gets around it.
- A force push written as `git push origin +main` isn't blocked. I can add a rule for it.

**Checks once it's in:** confirm the file is still valid JSON with the `allow` list unchanged, then run `bun test` and `bun run gate`, and show you the diff.

The plan is saved at `/root/.claude/plans/claude-md-asks-you-never-tender-clarke.md`. Should I go ahead as written, or add any of the extra rules?
````

## What you check in the plan

- Both forms of a force push are caught. For example, `git push origin main -f` puts the flag at the end.
- Claude Code adds `git commit -n`, the short form of `--no-verify`. That is a good catch. Keep it.
- Claude Code names a gap: `cat .env` in Bash is not a Read call. The "Gate the agent" part's next walls and the sandbox cover
  more. Here you only need the deny list.
- The allow list stays as it was.

## Prompt 2: approve

```text
Go ahead. Then run bun run verify deny-the-shortcuts and tell me what it prints.
```

Claude Code asks before it edits its own settings, because a change there changes what it may do. In the
recorded run nobody was there to approve, so it showed the deny list and stopped:

````text
I haven't made the change. Editing `.claude/settings.json` needs your permission, and the request wasn't approved. Claude Code asks before it lets Claude edit its own settings files.

I also haven't run `bun run verify deny-the-shortcuts`. With the file unchanged, it would only be checking the old version.

To go ahead, you can:
- **Approve the edit** when it asks again (just say "retry"), or
- **Make the edit yourself** by adding this inside `"permissions"`, after the `allow` line:

```json
"deny": [
  "Bash(git push --force*)",
  "Bash(git push * --force*)",
  "Bash(git push -f*)",
  "Bash(git push * -f*)",
  "Bash(git commit *--no-verify*)",
  "Bash(git push *--no-verify*)",
  "Bash(git commit -n*)",
  "Bash(git commit * -n*)",
  "Read(**/.env)",
  "Read(**/.env.*)"
]
```

Once the file is updated, I'll run the verify command and tell you exactly what it prints.
````

The settings file in this folder holds that list, word for word. When you run it yourself, approve the edit.
Then the check prints `Done. All 5 rules pass.`

## What you reject

- The rules in `ask` instead of `deny`. With nobody at the keyboard, ask protects nothing. The
  `wrong/shortcuts-in-ask/` answer shows it.
- Rules with no `*`, which match only one exact command. The `wrong/too-narrow/` answer shows it.
- Deny rules on every `git push` and `git commit`. They stop the builder's own work. The
  `wrong/deny-all-git/` answer shows it.

```bash
bun run verify deny-the-shortcuts solution
```

Expect: `Done. All 5 rules pass.`
