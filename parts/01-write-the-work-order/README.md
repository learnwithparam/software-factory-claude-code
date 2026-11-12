# Part 1: Write the work order

Answers the question: **does it know what done looks like?**

## The problem

A vague issue makes a vague pull request. Issue 5 at Northside is one line: "Only people who did the
induction should get the chainsaw." An agent working alone will guess which tools, which members, and what
the refused member is told, and the reviewer will fix the spec in review comments, one round at a time.

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
  S --> FA[The factory, from Part 5 on]
```

| Step | Minutes | What you produce |
|---|---|---|
| `write-the-issue-form` | 15 | `.github/ISSUE_TEMPLATE/change.yml` with required fields |
| `size-the-backlog` | 10 | `factory/backlog.json`: ready, split or refuse for all seven issues |
| `write-the-spec` | 25 | `specs/5/SPEC.md` with EARS requirements and `specs/5/passes.json` |

Each step's files go in that step's `problem/` folder. Open the Claude Code CLI there with `claude`.

## Walkthrough

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
