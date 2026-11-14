# Session moves for: Run from a label

A label starts a run in GitHub. A schedule starts one on a clock. Type `/schedule` and set a routine that runs
the factory on a timer, then save your session.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/05-run-it-unattended/02-run-from-a-label/problem
```

Expect: a line that starts with Saved your newest session.
