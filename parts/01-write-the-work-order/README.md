# Write the work order

Moves the **Outcome**: the typed issue and the spec that go into your factory.

Answers the question: **does it know what done looks like?**

## The problem

A vague issue makes a vague pull request. For example, issue 5 at Northside is one line: "Only people who
passed the induction may use the chainsaw."

An agent working alone will guess. Which tools? Which members? What is the refused member told? Then the
reviewer fixes the spec in review comments, one round at a time.

## Why it matters

Stripe "Migrated 10,000 lines of Scala to Java" with Claude Code (Anthropic's customer page, a vendor claim:
https://claude.com/customers/stripe). Work that size goes through because the target is exact: the old code
says what the new code must do. Anthropic's own engineers say that more than half of them can "fully
delegate" only between 0 and 20% of their work
(https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic). The work you can hand over is
the work you can describe exactly. This part makes the description a file the factory reads.

```mermaid
flowchart LR
  W[One-line wish] --> F[Issue form: required fields]
  F --> B{Size it: ready, split or refuse}
  B -- ready --> S[SPEC.md + passes.json]
  B -- refuse --> P[A person decides]
  B -- split --> N[Smaller issues]
  S --> FA[The factory, from Run it unattended on]
```

| Step                   | Minutes | What you produce                                                    |
| ---------------------- | ------- | ------------------------------------------------------------------- |
| `write-the-issue-form` | 15      | `.github/ISSUE_TEMPLATE/change.yml` with required fields            |
| `size-the-backlog`     | 10      | `factory/backlog.json`: ready, split or refuse for all seven issues |
| `write-the-spec`       | 25      | `specs/5/SPEC.md` with EARS requirements and `specs/5/passes.json`  |

Each step's files go in that step's `problem/` folder. You start Claude Code there, give it the job, read its
plan, and check what it wrote. Each step's `solution/prompts.md` shows the prompts from a real run.

Asking for a plan first is one of the [ways of working](../../00-orientation/ways-of-working.md) you will reuse.

## Watch and read

| Kind  | Title                          | Made by                | Why                                                                   | Link                                                            |
| ----- | ------------------------------ | ---------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| video | Claude Code best practices     | Cal Rueb, Anthropic    | An Anthropic engineer shows how the team uses Claude Code day to day. | https://www.youtube.com/watch?v=gv0WHhKelSE                     |
| video | How We Build Effective Agents  | Barry Zhang, Anthropic | Says when to use an agent and when a simpler flow is enough.          | https://www.youtube.com/watch?v=D7_ipDqhtwk                     |
| read  | Best practices for Claude Code | Anthropic docs         | Explains why a clear goal and a way to check it come first.           | https://code.claude.com/docs/en/best-practices                  |
| read  | Common workflows               | Anthropic docs         | Shows plan mode and how to point Claude Code at files.                | https://code.claude.com/docs/en/common-workflows                |
| read  | Building effective agents      | Anthropic engineering  | Why a clear task beats a clever agent.                                | https://www.anthropic.com/engineering/building-effective-agents |

## Walkthrough

You can ask Claude Code to run any check below. Type:

```text
Run this command and tell me what it printed. Do not change anything to make it pass.
```

The raw commands are:

```bash
bun run verify write-the-issue-form
```

Expect: `Done. All 7 rules pass.`

```bash
bun run verify size-the-backlog
```

Expect: `Done. All 8 rules pass.`

```bash
bun run verify write-the-spec
```

Expect: `Done. All 7 rules pass.`

```bash
bun run verify part write-the-work-order
```

Expect: `Part write-the-work-order is done: 3/3 steps pass.`

Compare with the sample answers at any time, for example `bun run verify write-the-spec solution`.

## Go further

Take an issue you wrote for your own project. Turn it into a typed issue and a spec in the same shape. Ask a friend to say what done looks like from the spec alone. The check does not grade this.
