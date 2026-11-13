# How Claude Code got here: write the issue form

You give Claude Code the job. It writes `change.yml`. You read its plan before it writes anything.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Rewrite .github/ISSUE_TEMPLATE/change.yml as a GitHub issue form for this tool library. It needs four required textareas with the ids outcome, acceptance, must-not-change and out-of-scope, and a required dropdown with the id risk and the options low, medium and high. Every field needs a label. Read ../../../../world/backlog/answers/5.json first: the required ids must match its keys. Show me your plan before you change anything.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code 2.1.323 in plan mode.

````text
Here's my plan. I haven't changed `change.yml` yet.

**What I found**
- The current `change.yml` has a single optional textarea with the id `what`.
- `world/backlog/answers/5.json` has five keys under `answers`: `outcome`, `acceptance`, `must-not-change`, `out-of-scope` and `risk`. The value for `risk` is `"medium"`.
- The README says to check the result with `bun run verify write-the-issue-form`, which should end with `Done. All 7 rules pass.`

**Proposed change:** I'll replace the whole of `.github/ISSUE_TEMPLATE/change.yml` with:

```yaml
name: Change request
description: Ask for a change to the tool library lending app, written as a work order.
title: "[Change]: "
body:
  - type: markdown
    attributes:
      value: |
        Write this so someone who cannot ask you questions can still finish it.
  - type: textarea
    id: outcome
    attributes:
      label: Outcome
      description: What is true when this is done? Who is affected, and what are they told?
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance
      description: One line per check a test can make, e.g. "Ben Halloran is refused saw-01".
      placeholder: "- ..."
    validations:
      required: true
  - type: textarea
    id: must-not-change
    attributes:
      label: Must not change
      description: Behaviour, wording or code that must stay exactly as it is.
    validations:
      required: true
  - type: textarea
    id: out-of-scope
    attributes:
      label: Out of scope
      description: Related work this request does not include.
    validations:
      required: true
  - type: dropdown
    id: risk
    attributes:
      label: Risk
      description: How bad a mistake would be. High means money, privacy or safety, and a person signs off.
      options:
        - low
        - medium
        - high
    validations:
      required: true
```

**Notes**
- The ids match the JSON keys exactly, with hyphens rather than underscores, and `medium` is one of the dropdown options.
- The intro text block is optional. It's a `markdown` element, and GitHub doesn't allow a label on those, so a strict reading of "every field has a label" could fail it. If the check flags it, I'll remove it. I can also leave it out from the start if you prefer.
- I've left out `labels:` and `assignees:` because I don't know which labels exist in the repo.

**Check after the change:** I'll run `bun run verify write-the-issue-form` and confirm that all 7 rules pass.

Should I go ahead, with or without the intro block?
````

## What you check in the plan

- The ids match the keys in `answers/5.json` letter for letter. For example, `must-not-change` uses hyphens, not `must_not_change`.
- Each of the five fields has `required: true`.
- `risk` is a `dropdown`, not a free text `input`.
- Claude itself asks about the markdown intro block. It has no label. Say no to it, so every field has a label.

## Prompt 2: approve, with your answer

```text
Go ahead. Leave out the markdown intro block. Then run bun run verify write-the-issue-form and tell me what it prints.
```

In the real run, Claude Code wrote the file and the check printed `Done. All 7 rules pass.`
The `change.yml` in this folder is one form that passes. Yours will use other words, and that is fine.

## What you reject

- Fields that are not required. GitHub's own samples use `required: false`. The `wrong/fields-not-required/` answer shows it.
- Risk as a text box, where people type "kinda risky". The `wrong/risk-as-free-text/` answer shows it.

```bash
bun run verify write-the-issue-form solution
```

Expect: `Done. All 7 rules pass.`
