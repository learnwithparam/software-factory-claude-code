# Assignment: enforce your spend cap at a gateway

Optional in the live session. Expected as homework.

## Task

Have Claude Code put your factory's spend cap into a LiteLLM gateway. The learner writes the prompts and
Claude Code writes the config. You hand in prompts and results, not code. The full walkthrough is in
`parts/07-track-agent-cost/01-track-agent-cost/problem/README.md`.

Work in this folder. It holds `compose.yml`, an empty `prompts.md` and `.env.example`.

## Done when

- The LiteLLM image is pinned to `v1.109.1`.
- A virtual key exists with `max_budget` set.
- One Claude Code stage completed through the proxy.
- A request after the budget was spent was refused.
- No key appears in the repo.

```bash
bun assignment/check.ts
```

Expect: `Done. All 5 lines pass.` The script writes `assignment/result.json` with `pass` or `fail` per line
and the LiteLLM version it found.

## Rubric

A person reads these three lines.

- The prompts are plain and reusable.
- The cap matches the one you built by hand.
- `CHOICE.md` says when you would pick agentgateway instead.

## Submit

Push a branch named `assignment` and send its URL. The grader runs the same check script.
