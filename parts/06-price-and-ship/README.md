# Part 6: Price and ship

Answers the question: **what did it cost, and was it worth it?**

## The problem

Nobody at the library can say what one pull request from the factory costs. Every stage runs on the same
large model. Nothing stops a run that loops. The only number anyone has is a monthly bill.

You fix this in three moves, each one a prompt to Claude Code.

- Give each stage a model by its role. A role is a name for a kind of model: fast, smart or judge.
- Put a cap on what one run may spend.
- Run the factory over the whole backlog and score it.

For example, here is what one real run of the finished factory on issue 2 cost, stage by stage.

| Stage  | Role  | Cost in USD |
| ------ | ----- | ----------- |
| triage | fast  | 0.0035      |
| spec   | smart | 0.0959      |
| build  | smart | 0.0590      |
| review | judge | 0.0483      |
| total  |       | 0.2067      |

Triage is cheap because it only reads. On issue 6, triage refused the work, and the whole run cost $0.0028.
These numbers come from `world/recordings/issue-2/run-1/result.json` and the issue 6 run beside it.

A **scorecard** is the last report. `bun run scorecard` reads every result file and says which targets you
met.

## Why it matters

Anthropic's cost page (https://code.claude.com/docs/en/costs) gives an average of "$150-250 per developer
per month". That is across enterprise deployments. It adds: "Per-developer costs vary widely based on model
selection, codebase size, and usage patterns such as running multiple instances or automation".

A factory is that kind of automation. Anthropic's own harness research ran at $200 against $9 for a solo run
(https://www.anthropic.com/engineering/harness-design-long-running-apps). So the course ends with your own
number, per issue and per stage. You measure it. It is not a vendor's number.

```mermaid
flowchart LR
  T[triage: fast] --> S[spec: smart] --> P[plan: smart, high risk only] --> B[build: smart] --> R[review: judge]
  C{{run budget checked before each stage}} -.-> T & S & P & B & R
  B & R --> L["result.json: roles_by_stage, cost_usd"] --> SC[bun run scorecard]
```

| Step                    | Minutes | What you produce                                         | What its check reads                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `route-models-by-stage` | 15      | a model per agent, set by role                           | each agent file sets `model`; `result.json` records `roles_by_stage`; a high-risk issue plans on the smart role; the docs issue never does                                                                                                                                                                                |
| `cap-the-spend`         | 10      | a run budget in `factory/run.ts`, the key kept in `.env` | with `FACTORY_CAP_USD=0.05` the run ends with state `stopped_budget`; a secret scan of tracked files finds no key                                                                                                                                                                                                         |
| `ship-the-factory`      | 25      | runs over issues 1 to 7, the scorecard, `notes/retro.md` | `bun run scorecard`: 3 of issues 1 to 5 at `draft_pr` with branches whose tests pass the local gate, 0 test files edited, issue 3 blocked once, issue 6 refused, issue 7 stopped at plan, cost under the cap, `cost_usd` equal to the summed `total_cost_usd` of the logged calls; the retro has three headings with text |

## Walkthrough

TODO(part session): write each step's walkthrough and replace these Expect lines with real output.

```bash
bun run verify route-models-by-stage
```

Expect: TODO(part session)

```bash
bun run verify cap-the-spend
```

Expect: TODO(part session)

```bash
bun run verify ship-the-factory
```

Expect: TODO(part session)
