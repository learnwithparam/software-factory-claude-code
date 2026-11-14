# Session moves for: Run one issue headless

A headless run needs a permission mode, so nothing waits for a click. Name it on every call. Then try
`/loop` in a session: it repeats a prompt on a timer, which is how a person watches a run without typing.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/05-run-it-unattended/01-run-one-issue-headless/problem
```

Expect: a line that starts with Saved your newest session.
