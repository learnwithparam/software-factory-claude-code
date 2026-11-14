# Session moves for: Demand proof before stop

A hook can refuse to let Claude Code stop. A goal says what done means. Type `/goal` with a stop condition such
as the gate passing. Claude Code keeps working until the condition holds.

Save your session so the check can read it. Run this from the folder where you started `claude`:

```bash
bun run save-session parts/04-gate-the-agent/03-demand-proof-before-stop/problem
```

Expect: a line that starts with Saved your newest session.
