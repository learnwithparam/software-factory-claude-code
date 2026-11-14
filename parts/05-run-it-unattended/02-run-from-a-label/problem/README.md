# Run from a label

## The problem

The factory runs on your laptop. The library wants it to start from GitHub when a coordinator labels an issue.

The old workflow, `workflow/claude.yml`, starts Claude on any `@claude` comment. It has no caps and no timeout.
For example, two volunteers who comment on issue 3 start two runs. Both spend and push.

```mermaid
flowchart LR
  P[A person adds factory:ready to issue 3] --> W[workflow/factory.yml]
  W --> A[claude-code-action with caps]
  A --> F[bun run factory 3 --json]
  F --> D[Draft pull request]
  D --> H[A person reviews and merges]
  O[Any other label, any comment] -.-> X[Nothing runs]
```

## Your challenge

Get Claude Code to write `workflow/factory.yml`. In your own repo it goes in `.github/workflows/`.

Start Claude Code:

```bash
cd parts/05-run-it-unattended/02-run-from-a-label/problem
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

Press Shift+Tab until you see plan mode ([ways of working](../../../../00-orientation/ways-of-working.md)), then type:

```text
Read CLAUDE.md, factory/run.ts and workflow/claude.yml. Plan workflow/factory.yml: it runs the factory when a person adds the label factory:ready to an issue, and only then. It uses anthropics/claude-code-action@v1 and the CLAUDE_CODE_OAUTH_TOKEN secret, never a key in the file. It sets --max-turns and --max-budget-usd in claude_args, has one concurrency group per issue and a timeout, names its permissions, and opens the pull request as a draft. It never merges. It never puts an issue title or body in the prompt or a shell line. Show me the plan and the YAML. Write nothing yet.
```

Check the YAML. Then press Shift+Tab until plan mode is off, then type:

```text
Go ahead. Write workflow/factory.yml now. Leave workflow/claude.yml as it is.
```

Then do the [session moves](SESSION-MOVES.md).

## Done when

- The workflow triggers only on `issues` with type `labeled`.
- Every job runs only when the label is `factory:ready`.
- It uses `anthropics/claude-code-action@v1` and signs in with a secret. No key is in the file.
- `claude_args` has `--max-turns` and `--max-budget-usd`.
- Each issue has its own concurrency group, and each job has `timeout-minutes`.
- Every job names its permissions.
- The pull request opens as a draft, and nothing merges it.
- No issue title or body goes into the prompt or a shell line.
- Your saved session shows the session moves.

Ask Claude Code:

```text
Run `bun run verify run-from-a-label` and tell me what it printed. Do not change anything to make it pass.
```

```bash
bun run verify run-from-a-label
```

Expect: `Done. All 10 rules pass.`

## If you get stuck

| What you see                                           | What to tell Claude Code                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `FAIL every job runs only for the label factory:ready` | "A labeled trigger fires for every label. Add an if on the job for factory:ready." |
| `FAIL ... signs in with a secret`                      | "Pass the token from secrets. Delete the key from the file."                       |
| `FAIL ... draft and never merges`                      | "Open the PR with gh pr create --draft, and remove any merge step."                |

## Words you will use

- **Workflow**: a YAML file that tells GitHub Actions what to run, and when.
- **Trigger**: the event that starts a workflow, here a label added to an issue.
- **Secret**: a value GitHub stores for you and hands to the workflow. It never sits in a file.
- **Concurrency group**: GitHub runs one job per group at a time. One group per issue means one run per issue.
- **Draft pull request**: a pull request that cannot be merged until a person marks it ready.
