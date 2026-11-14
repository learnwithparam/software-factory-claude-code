# Session moves for: Build the reviewer

Run `/code-review` on a small change. Ask Claude Code to hand the work to your reviewer subagent, so the
builder never grades its own work.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/03-split-the-roles/03-build-the-reviewer/problem
```

Expect: a line that starts with Saved your newest session.
