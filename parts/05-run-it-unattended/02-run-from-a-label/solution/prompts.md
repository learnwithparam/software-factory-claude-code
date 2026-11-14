# How Claude Code got here: run from a label

Claude Code wrote `workflow/factory.yml`. You read the YAML it planned and fix one thing before it writes.
The files in this folder are what it wrote in a real run with Claude Code.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

Press Shift+Tab until you see plan mode, then type:

```text
Read CLAUDE.md, factory/run.ts and workflow/claude.yml. Today anyone can start Claude by mentioning @claude in a comment, with no caps. Plan a new workflow, workflow/factory.yml (in a real repo it goes in .github/workflows/), that runs the factory when a person adds the label factory:ready to an issue, and only then. It uses anthropics/claude-code-action@v1 and the CLAUDE_CODE_OAUTH_TOKEN secret, never a key in the file. It sets --max-turns and --max-budget-usd in claude_args, has one concurrency group per issue and a timeout, gives the job only the permissions it needs, and opens the pull request as a draft. It never merges. Show me the plan and the YAML you would write. Do not write any file yet.
```

## The plan Claude Code showed

````text
Here is the plan and the YAML. I haven't written `workflow/factory.yml`; the plan is saved at `~/.claude/plans/read-claude-md-factory-run-ts-and-abundant-tide.md`.

## The plan

**The problem today:** `workflow/claude.yml` starts Claude for any comment containing `@claude`. It has no turn or budget cap, no concurrency limit, no timeout, and broad permissions.

1. **Trigger:** the only trigger is `issues: [labeled]`. The job runs only if the label is `factory:ready` and the person who added it is a real user (`sender.type == 'User'`), so bots and other workflows can't start it. There are no comment or push triggers. Only collaborators with triage or write access can add labels.
2. **Claude:** it runs through `anthropics/claude-code-action@v1` with `secrets.CLAUDE_CODE_OAUTH_TOKEN`. The file contains no key. `claude_args` sets:
   - `--max-turns 4 --max-budget-usd 1`. These cap only this outer session, which just starts the runner.
   - `--permission-mode dontAsk`, and `--allowedTools` set to one exact command: `bun run --cwd <factory> factory <n> --json`.
   - `--disallowedTools` blocking `gh pr merge`, `gh pr ready` and `git push`, as a second guard.

   The stages that `run.ts` starts keep their own per-stage caps, and the job sets `FACTORY_CAP_USD=10` to cap the whole run.
3. **The draft PR is guaranteed:** pushing and opening the PR happen in plain shell steps, not in Claude's hands. They run only when `result.json` says `state == draft_pr`. The factory's copy is a separate git repo with no shared history, so the change has to come over as a patch:
   - make a patch of `factory-base..HEAD`, leaving out `.factory/`
   - apply it to `world/app` on a new branch `factory/issue-<n>`
   - commit, push and run `gh pr create --draft`.

   Nothing in the file merges, turns on auto-merge or marks a PR ready.
4. **Concurrency:** one group per issue (`factory-issue-<n>`) with `cancel-in-progress: false`. Adding the label twice queues a second run instead of killing a run that is already spending money.
5. **Timeout:** `timeout-minutes: 45`. Claude's Bash tool stops a command after 10 minutes by default, and a full run takes longer, so the step raises that limit to 40 minutes.
6. **Permissions:** none at workflow level. The job gets only:
   - `contents: write` to push the branch
   - `pull-requests: write` to open the draft
   - `issues: write` to comment and remove the label.

   It doesn't need `id-token`, because the action is given `github_token`.
7. **Every run, pass or fail:**
   - the run's folder (transcripts, `commands.txt`, `result.json`) is uploaded as an artifact
   - the state and cost are posted as a comment on the issue
   - `factory:ready` is removed, so running again takes a person adding the label again.
8. **Untrusted text:** only the issue number reaches a shell, through `env:`. The issue's title and body never do.

**Trade-off:** a PR opened with `GITHUB_TOKEN` doesn't start other workflows. The gate runs when a person clicks "Ready for review", but only if `gate.yml` listens for `ready_for_review`. That keeps a person between the factory and CI, and between CI and merge.

## The YAML

```yaml
# Runs the factory on one issue when a person adds the label factory:ready, and only then.
# In your own repo this file lives in .github/workflows/.
# It opens at most a draft pull request. It never merges, enables auto-merge or marks a PR ready.
name: Factory

on:
  issues:
    types: [labeled]

permissions: {}

jobs:
  factory:
    if: github.event.label.name == 'factory:ready' && github.event.sender.type == 'User'
    runs-on: ubuntu-latest
    timeout-minutes: 45
    concurrency:
      group: factory-issue-${{ github.event.issue.number }}
      cancel-in-progress: false
    permissions:
      contents: write
      pull-requests: write
      issues: write
    env:
      ISSUE: ${{ github.event.issue.number }}
      FACTORY_DIR: factory-root # the folder that holds factory/run.ts and package.json
      APP_DIR: world/app # the app the factory copies; the patch lands here
      FACTORY_CAP_USD: "10"
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run the factory
        uses: anthropics/claude-code-action@v1
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          BASH_DEFAULT_TIMEOUT_MS: "2400000"
          BASH_MAX_TIMEOUT_MS: "2400000"
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          github_token: ${{ github.token }}
          prompt: |
            Run this one command and nothing else, then reply with the "state" from its output:
            bun run --cwd ${{ env.FACTORY_DIR }} factory ${{ env.ISSUE }} --json
          claude_args: >-
            --max-turns 4
            --max-budget-usd 1
            --permission-mode dontAsk
            --allowedTools "Bash(bun run --cwd ${{ env.FACTORY_DIR }} factory ${{ env.ISSUE }} --json)"
            --disallowedTools "Bash(gh pr merge *),Bash(gh pr ready *),Bash(git push *)"

      - name: Read the result
        id: result
        run: |
          file="$FACTORY_DIR/runs/$ISSUE/result.json"
          if [ ! -f "$file" ]; then echo "state=no_result" >> "$GITHUB_OUTPUT"; exit 0; fi
          echo "state=$(jq -r .state "$file")" >> "$GITHUB_OUTPUT"
          echo "cost=$(jq -r .cost_usd "$file")" >> "$GITHUB_OUTPUT"

      - name: Keep the run record
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: factory-issue-${{ env.ISSUE }}
          path: ${{ env.FACTORY_DIR }}/runs/${{ env.ISSUE }}/
          if-no-files-found: warn

      - name: Push the branch
        if: steps.result.outputs.state == 'draft_pr'
        run: |
          copy="$FACTORY_DIR/runs/$ISSUE/repo"
          git -C "$copy" diff --binary factory-base HEAD -- . ':(exclude).factory' > factory.patch
          git switch -c "factory/issue-$ISSUE"
          git apply --directory="$APP_DIR" factory.patch
          rm factory.patch
          git add -A "$APP_DIR"
          git -c user.name="Northside factory" -c user.email="factory@users.noreply.github.com" \
            commit -m "factory: issue #$ISSUE"
          git push origin "factory/issue-$ISSUE"

      - name: Open a draft pull request
        if: steps.result.outputs.state == 'draft_pr'
        run: |
          gh pr create --draft \
            --head "factory/issue-$ISSUE" \
            --title "factory: issue #$ISSUE" \
            --body "Closes #$ISSUE. Opened by the factory as a draft. A person reviews, marks it ready, and merges."

      - name: Report on the issue
        if: always()
        run: |
          gh issue comment "$ISSUE" --body \
            "Factory run finished: \`${{ steps.result.outputs.state || 'error' }}\`, cost \$${{ steps.result.outputs.cost || '0' }}. Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          gh issue edit "$ISSUE" --remove-label "factory:ready"
```

**Things to know:**
- **`FACTORY_DIR` is a placeholder.** Set it to wherever `factory/run.ts` lives in the real repo. In this course layout it's this step folder.
- **Issues need a backlog file.** The runner reads issues from `world/backlog/<n>-*.md`, so a label on an issue with no backlog file fails without doing anything.
- **Existing branches and PRs make the run fail.** If branch `factory/issue-<n>` or its PR already exists, the push or PR step fails loudly. I chose that over force-pushing, so a person's fixes on that branch are never overwritten.
- **`claude.yml` is still there.** I'd leave it alone in this change. Deleting or disabling it once this file replaces it is a separate decision.

**Once you approve, how I'd check it:**
1. Run `bun run verify run-from-a-label` from the repo root.
2. Run `actionlint workflow/factory.yml`, if it's installed.
3. Run the allowed command as a dry run (`--dry-run`) to confirm the `result.json` fields the later steps read.
4. Try it on a scratch GitHub repo:
   - adding the label should give one draft PR, a comment, and the label removed
   - adding it twice quickly should queue the second run
   - any other label should start nothing.
````

## What you check in the plan

- One trigger only: `issues` with `labeled`. The job's `if` asks for `factory:ready`.
- The token comes from `secrets`. Look for it twice: the plan passes it in `env` and in `with`. Once is enough.
- `claude_args` caps the outer run. The factory's own stages keep their own caps from `factory/run.ts`.
- `concurrency` names the issue number, and `timeout-minutes` is set.
- The PR is opened with `gh pr create --draft` in a plain shell step. Claude never holds the merge.
- Claude Code says what it does not know: a real repo must set `FACTORY_DIR`, and a factory PR made with the
  workflow token does not start other workflows.

## Prompt 2: fix one thing, then approve

```text
Good plan. One change: pass the token to the action once, through claude_code_oauth_token. Remove CLAUDE_CODE_OAUTH_TOKEN from the step's env, so the secret appears in one place only. Keep everything else. Write workflow/factory.yml now, then parse it with bun -e "Bun.YAML.parse(await Bun.file('workflow/factory.yml').text())" to show it is valid YAML. Leave workflow/claude.yml as it is.
```

## What Claude Code reported

```text
I wrote `workflow/factory.yml` and it parses as valid YAML: `bun -e "Bun.YAML.parse(...)"` finished without error.

- **Token change:** the secret now appears once, in `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`. A search of the file finds that one line only. The step's `env:` now holds just the two Bash timeout settings.
- **Everything else** is as in the plan.
- **`workflow/claude.yml`** is unchanged. The whole `workflow/` folder shows as untracked in git, so neither file is committed yet.

One risk from the token change: `run.ts` starts its own `claude -p` calls inside the action's session, and those now get the token only if the action passes it down to them. I believe it does, but I haven't confirmed it. If the first real run fails to sign in at the triage stage, the fix is to give the token to the factory command itself, which means a second mention of the secret.

I also tried to run the step's check, `bun run verify run-from-a-label`, but it needed your approval and I didn't wait for it, so the check hasn't run. You can run it from the repo root.
```

Claude Code is honest about one open question: whether the inner `claude -p` calls get the token. Try the
workflow in a scratch repo before you trust it. That test needs your own GitHub repo, so this course does not
check it.

## What you reject

- A workflow that runs for every label. The `wrong/every-label/` answer shows it.
- A token written into the file. The `wrong/key-in-the-file/` answer shows it.
- No caps and no timeout. The `wrong/no-caps/` answer shows it.

```bash
bun run verify run-from-a-label solution
```

Expect: `Done. All 8 rules pass.`
