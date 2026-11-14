# Session moves for: Meet the library

Now try three small moves in a new session. Open `claude` at the repo root, not in a step folder. Press
Shift+Tab until plan mode shows, which means Claude Code can read but not change files. Ask your question about
the issues. Then type `@` and a file name, such as `@world/backlog/2-split-loses-a-cent.md`, to point at one
file. Last, drag a screenshot into the prompt and ask what it shows. Use the screenshot from the finished run
below.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/00-meet-the-library/01-meet-the-library/problem
```

Expect: a line that starts with Saved your newest session.
