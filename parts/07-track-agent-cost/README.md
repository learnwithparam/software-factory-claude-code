# Track agent cost with LiteLLM

Moves the **Goal**: the spend cap you built by hand now lives in the open-source gateway teams run.

Answers the question: **can anything go around my cap?**

## The problem

Your cap lives in the factory script. A run that does not use the script is not capped. A gateway counts
spend for every request that passes through it. This part is short, and it is optional in the live session.

For example, a run started by hand in a terminal never touches the factory script. The gateway still counts it.

```mermaid
flowchart LR
  C[Claude Code] --> L[LiteLLM proxy with a budgeted key] --> M[model]
  L -.->|over budget| X[refused]
```

| Step               | Minutes | What you produce                                         |
| ------------------ | ------- | -------------------------------------------------------- |
| `track-agent-cost` | 15      | `prompts.md`, and the proxy's key info and refusal saved |

## Watch and read

| Kind  | Title                          | Made by                | Why                                                                   | Link                                             |
| ----- | ------------------------------ | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| video | Claude Code best practices     | Cal Rueb, Anthropic    | An Anthropic engineer shows how the team uses Claude Code day to day. | https://www.youtube.com/watch?v=gv0WHhKelSE      |
| video | How We Build Effective Agents  | Barry Zhang, Anthropic | Says when to use an agent and when a simpler flow is enough.          | https://www.youtube.com/watch?v=D7_ipDqhtwk      |
| read  | Manage costs effectively       | Anthropic docs         | Where spend comes from and how to cap it.                             | https://code.claude.com/docs/en/costs            |
| read  | Monitoring usage               | Anthropic docs         | Cost and token counts straight from Claude Code.                      | https://code.claude.com/docs/en/monitoring-usage |
| read  | Best practices for Claude Code | Anthropic docs         | Why watching cost belongs in the plan from day one.                   | https://code.claude.com/docs/en/best-practices   |

## Walkthrough

You can ask Claude Code to run any check below. Type:

```text
Run this command and tell me what it printed. Do not change anything to make it pass.
```

The raw commands are:

At the repo root, after Claude Code did the work in `assignment/`:

```bash
bun assignment/check.ts
```

Expect: `Done. All 5 lines pass.`

```bash
bun run verify track-agent-cost
```

Expect: `Done. All 5 rules pass.`

Compare with the sample answer at any time:

```bash
bun run verify track-agent-cost solution
```

Expect: `Done. All 5 rules pass.`

## Go further

Set the key's budget to half of what one run costs. Run the factory and read what the proxy says when the budget is spent. The check does not grade this.

## Finished

You moved one hand-built idea onto a real tool. The cap is now a key with a budget, and the proxy says no
when it is spent.
