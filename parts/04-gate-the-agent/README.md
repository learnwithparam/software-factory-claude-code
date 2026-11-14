# Gate the agent

Moves the **Outcome**: the gate the agent cannot skip, as four walls you can test.

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

| Step                       | Minutes | What you produce                                                                               | What its check reads                                                                                                                                                                                           |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deny-the-shortcuts`       | 10      | `permissions.deny` in `.claude/settings.json`                                                  | force push, `--no-verify` and reading `.env` decided with the rule grammar in `checks/lib/permissions.ts`: each `deny`; everyday work not denied                                                               |
| `lock-the-tests`           | 20      | a PreToolUse hook and its entry in settings                                                    | the real recorded test edit and the planted `sed -i` command, replayed into the hook with `FACTORY_STAGE=build`: blocked with a reason; spec stage and `src/` edits allowed                                    |
| `demand-proof-before-stop` | 15      | a Stop hook                                                                                    | the real Stop event in a copy of the app: blocks with no gate record, an older tree or a failed gate; allows a fresh pass and `stop_hook_active`                                                               |
| `protect-the-main-branch`  | 15      | `github/workflows/gate.yml`, `github/CODEOWNERS` and `factory/ruleset.json` in the step folder | offline: the `gate` job runs `bun run gate` with a read-only token; CODEOWNERS covers `.claude/`, `.github/`, `factory/`; the ruleset requires a PR, the `gate` check from app 15368, no force push, no bypass |

Claude Code writes every file in this table. You give it the job, read its plan, and approve the writes. Each
step's `problem/` folder is where you start `claude`. Each step's `solution/prompts.md` shows the prompts, the
plan and the reply from a real run.

In the last step the workflow and CODEOWNERS sit in a folder named `github/`. In your own repo that folder is
`.github/`. Here it keeps its plain name, so this course repo never runs your workflow.

## Walkthrough

Do each step's challenge in its `problem/` folder first. Then run its check from the repo root.

```bash
bun run verify deny-the-shortcuts
```

Expect: `Done. All 5 rules pass.`

```bash
bun run verify lock-the-tests
```

Expect: `Done. All 7 rules pass.`

```bash
bun run verify demand-proof-before-stop
```

Expect: `Done. All 7 rules pass.`

```bash
bun run verify protect-the-main-branch
```

Expect: `Done. All 8 rules pass.`

```bash
bun run verify part gate-the-agent
```

Expect: `Part gate-the-agent is done: 4/4 steps pass.`

To see a passing answer at any time, check the sample solution. For example:

```bash
bun run verify lock-the-tests solution
```

Expect: `Done. All 7 rules pass.`

## Assignment

**The problem:** a rule in a Markdown file is a request, not a wall.

**What you hand in:** one commit on your own copy of the course. It holds the deny rules, `lock-tests.ts`
and the Stop hook in `.claude/`. It also holds `gate.yml`, `CODEOWNERS` and `factory/ruleset.json`.

**How it is checked:** each line is yes or no.

1. Does `bun run verify deny-the-shortcuts` pass?
2. Does `bun run verify lock-the-tests` pass, with the `sed -i` edit blocked in the build stage?
3. Does `bun run verify demand-proof-before-stop` pass, with a stale gate record blocked?
4. Does `bun run verify protect-the-main-branch` pass, with the `gate` check pinned to app 15368?

**Extension:** apply the ruleset to your own repo with
`gh api -X POST repos/OWNER/REPO/rulesets --input factory/ruleset.json`. Then try three bypasses: post a
status named `gate` with your own token, commit with `--no-verify`, and change a test through Bash. Write
down which wall stopped each one.

## Finished

You now have four walls, each tested on real events. Deny rules refuse the shortcuts before a tool runs.
The lock-tests hook stops the builder changing a test. The Stop hook keeps it working until the gate passed
on the code as it is now. On GitHub, only a real workflow run can turn the `gate` check green, and a person
must approve.

Next, in the "Run it unattended" part, you run the factory with nobody at the keyboard: `claude -p` for one issue, then a GitHub
label that starts a run.
