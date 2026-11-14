# Session moves for: Trim the agents file

Run `/init` first in a session at the repo root. It writes a starter memory file by reading the repo. Then
trim that file down to the three headings below. The check also keeps your CLAUDE.md far under 200 lines.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/02-teach-the-repo/01-trim-the-agents-file/problem
```

Expect: a line that starts with Saved your newest session.
