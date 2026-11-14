# Session moves for: Size the backlog

Two safety moves matter when Claude Code goes the wrong way. Press Esc while it works, and it stops. Type
`/rewind` and pick an earlier point, and the code and the chat go back to that point. Do both once on this step,
on purpose, then save your session.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/01-write-the-work-order/02-size-the-backlog/problem
```

Expect: a line that starts with Saved your newest session.
