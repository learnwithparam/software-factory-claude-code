# How Claude Code got here: run one issue on your repo

This is a worked example of the files you produce. The repo name and the pull request link are made up for the
example. Your files hold your own repo, your own issue and your own run.

## Prompt 1: pick one issue

Start Claude Code in your own repo, in plan mode, and type:

```text
Read this repo and its open issues. Pick one issue that changes one or two files and has an outcome I can check by reading. Tell me why it is a good first one. Change nothing.
```

## Prompt 2: run it with the fence on

```text
Work on that issue on a branch named factory/issue-<number>. Do not edit any test file. Run the tests and the lint. Open a draft pull request. Never merge.
```

## Prompt 3: write the evidence

```text
Fill in evidence/run.json with the repo, issue, branch, pull request link, whether it is a draft, whether the gate passed, the files changed, the cost and the cap. Save the gate output to evidence/gate.txt and a copy of .claude/settings.json to evidence/claude-settings.json. Then fill in notes/own-repo.md. Use only what really happened.
```
