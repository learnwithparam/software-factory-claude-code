# Part 4: Gate the agent

Answers the question: **who has the last word?**

## The problem

A rule in an instructions file is a request. Claude Code follows it nearly every time. But one time in many,
it does not.

For example, issue 2 needs a fix in `src/fees/split.ts`. Its test is `tests/fees/split.test.ts`. When that
test fails, Claude Code could edit the test until it passes, instead of fixing the code. Or it could push with
`--no-verify`, which tells git to skip its checks.

So the library needs walls that Claude Code cannot get around. A **hook** is a small script that Claude Code
runs at a set moment, for example before a tool runs. There are four walls.

1. **Deny rules** refuse a tool call before the tool runs.
2. A **PreToolUse hook** runs before each tool call, and can block it.
3. A **Stop hook** runs when Claude Code wants to stop. It can send Claude Code back to run the gate.
4. A **required check** on the main branch runs on GitHub. No file on your computer can change it.

The finished factory has the second wall in `world/finished/factory/.claude/hooks/lock-tests.ts`. When Claude
Code tries to edit a test in the build stage, the hook stops it. Claude Code gets a reason back, like this one:

"Blocked: tests/fees/split.test.ts is a test file and tests are locked in the build stage."

You ask Claude Code to build each wall. You read its plan, approve it, and run the check.

## Why it matters

Google Cloud's DORA 2025 report surveyed "nearly 5,000 technology professionals". It found that "90% of survey
respondents report using AI at work". Yet "AI adoption does continue to have a negative relationship with
software delivery stability". In plain words, more AI use went with less stable software.

The report names the cure: "strong automated testing, mature version control practices, and fast feedback
loops". Without these, "an increase in change volume leads to instability"
(https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report).

Anthropic's best-practice page says it plainly. "If something has to happen every time, make it a hook, a deny
rule, or a managed setting." (https://code.claude.com/docs/en/best-practices).

```mermaid
flowchart LR
  A[Agent wants a tool call] --> D{deny rules}
  D -- force push, --no-verify, read .env --> X1[denied]
  D --> H{PreToolUse hook: lock-tests}
  H -- edit to tests/ in build --> X2[exit 2, reason back to the agent]
  H --> T[tool runs]
  T --> S{Stop hook}
  S -- no fresh gate pass --> X3[block: run the gate]
  S --> PR[branch + draft PR]
  PR --> Q{required check gate, pinned to the CI app}
```

| Step                       | Minutes | What you produce                                                                         | What its check reads                                                                                                                                                                                                                       |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deny-the-shortcuts`       | 10      | `permissions.deny` in `.claude/settings.json`                                            | recorded tool calls (force push, `--no-verify`, read `.env`) matched with the rule grammar in `checks/lib/permissions.ts`, each expected `deny`                                                                                            |
| `lock-the-tests`           | 20      | a PreToolUse hook and its entry in settings                                              | the planted bad command and a test edit, replayed into the hook with `FACTORY_STAGE=build`: blocked with a reason; the same edit in `spec` and an edit to `src/` allowed                                                                   |
| `demand-proof-before-stop` | 15      | a Stop hook                                                                              | replayed Stop events: blocks with no gate record, blocks on a record for an older tree, allows a fresh pass, never loops when `stop_hook_active` is true                                                                                   |
| `protect-the-main-branch`  | 15      | `.github/workflows/gate.yml`, `CODEOWNERS` and `factory/ruleset.json` in the step folder | offline: the workflow runs `bun run gate` as a job named `gate`; CODEOWNERS covers `.claude/`, `.github/`, `factory/`; the ruleset requires a PR and the `gate` check from a named app, blocks force pushes, has no bypass for the factory |

## Walkthrough

TODO(part session): write each step's walkthrough and replace these Expect lines with real output.

```bash
bun run verify deny-the-shortcuts
```

Expect: TODO(part session)

```bash
bun run verify lock-the-tests
```

Expect: TODO(part session)

```bash
bun run verify demand-proof-before-stop
```

Expect: TODO(part session)

```bash
bun run verify protect-the-main-branch
```

Expect: TODO(part session)
