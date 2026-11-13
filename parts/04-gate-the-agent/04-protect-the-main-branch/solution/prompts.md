# How Claude Code got here: protect the main branch

Claude Code writes the workflow, the owners file and the ruleset. You check that the gate check is pinned to
the GitHub Actions app and that nobody can bypass the rules. The files in this folder are what it wrote in a
real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Write three files that protect main on GitHub. We keep them in a folder named github/ here, not .github/, so this course repo does not run them; in your own repo the folder is .github/. First, github/workflows/gate.yml: on pull_request, one job called gate that checks out the code, sets up Bun, runs bun install and then bun run gate, with a read-only token (permissions: contents: read). Second, github/CODEOWNERS: give /.claude/, /.github/ and /factory/ to the team @northside/coordinators, so the factory can never approve a change to its own walls. Third, factory/ruleset.json, a GitHub repository ruleset I can apply with gh api: an active branch ruleset on the default branch that requires a pull request with one approving review from a code owner, requires the status check gate from the GitHub Actions app (integration_id 15368), blocks force pushes, and has no bypass actors. Show me your plan before you write anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code 2.1.323 in plan mode.

````text
I haven't written anything yet. All three files go in the problem folder, which right now holds only `README.md` and `CLAUDE.md`. The plan is saved at `/root/.claude/plans/write-three-files-that-functional-pancake.md`.

**1. `github/workflows/gate.yml`**
- Runs on `pull_request`.
- `permissions: contents: read` is set for the whole workflow, so the token is read-only.
- One job, given the explicit name `gate` so its check is called `gate`. That's the name the ruleset will require.
- Steps: `actions/checkout@v4`, then `oven-sh/setup-bun@v2`, then `bun install`, then `bun run gate`.

**2. `github/CODEOWNERS`**
```
/.claude/   @northside/coordinators
/.github/   @northside/coordinators
/factory/   @northside/coordinators
```
These are the paths as they'll be in your real repo. `/.github/` also covers the CODEOWNERS file itself, and `/factory/` covers the ruleset, so changing any of these rules needs a coordinator's approval.

**3. `factory/ruleset.json`**
- `target: branch`, `enforcement: active`, applied to `~DEFAULT_BRANCH`, with `bypass_actors: []`.
- `pull_request`: 1 approving review, `require_code_owner_review: true`.
- `required_status_checks`: `{ "context": "gate", "integration_id": 15368 }`.
- `non_fast_forward`, which blocks force pushes.
- To apply it: `gh api -X POST repos/OWNER/REPO/rulesets --input factory/ruleset.json`

**Choices I made that you can change:**
- **Version pinning:** the actions are pinned to major-version tags, not commit SHAs.
- **Rules I left out:** blocking branch deletion (`deletion`), dismissing stale approvals when new commits are pushed, and requiring the branch to be up to date before merging. You didn't ask for them; each is a one-line addition.

**Checks after writing:**
- Parse the YAML and JSON to make sure they're valid.
- Run `bun run gate` from the course root, which is what CLAUDE.md requires for "done", and report the real result.

I won't commit or push unless you ask. Say go, or tell me what to change.
````

## What you check in the plan

- The job is named `gate`, so the check on the pull request is named `gate` too.
- The required check carries `integration_id` 15368. For example, without it, a token that can write to the
  repo can post a green `gate` status by hand.
- `bypass_actors` is empty. A bypass for the factory's own app would be a door around every wall.
- `/.github/` in CODEOWNERS also covers CODEOWNERS itself, so changing who owns what needs a coordinator.

## Prompt 2: approve

```text
Go ahead. Then run bun run verify protect-the-main-branch and tell me what it prints.
```

Claude Code wrote the three files and ran the check:

````text
I wrote the three files and the verifier passes all 8 checks. I couldn't run `bun run gate` (the "done" check in CLAUDE.md) because it needs your approval.

The files are in the problem folder:
- `github/workflows/gate.yml`
- `github/CODEOWNERS`
- `factory/ruleset.json`

Each matches the plan exactly.

`bun run verify protect-the-main-branch` printed:

```
$ bun scripts/verify.ts protect-the-main-branch
Checking protect-the-main-branch (your work):
  PASS  github/workflows/gate.yml parses and runs on pull_request
  PASS  a job named gate runs bun run gate
  PASS  the workflow's token can only read
  PASS  github/CODEOWNERS gives .claude/, .github/ and factory/ to a person or team
  PASS  factory/ruleset.json is an active branch ruleset on the default branch
  PASS  the ruleset requires a pull request with a code owner's review
  PASS  the ruleset requires the gate check from the Actions app, id 15368
  PASS  the ruleset blocks force pushes and lets nobody bypass it
Done. All 8 rules pass.
Progress: 1/8 steps pass.
```

The last line, "Progress: 1/8 steps pass", reads as progress across the whole course, not this part.

I also didn't get to run my own YAML/JSON parse check, which was blocked too. The verifier's "parses" check covers the workflow file. Approve `bun run gate` if you want the done-check run. Nothing is committed.
````

## What you reject

- A required check with no `integration_id`. The `wrong/check-not-pinned/` answer shows it.
- A bypass for the factory's app. The `wrong/factory-can-bypass/` answer shows it.
- A workflow token that can write. The `wrong/token-can-write/` answer shows it.

```bash
bun run verify protect-the-main-branch solution
```

Expect: `Done. All 8 rules pass.`
