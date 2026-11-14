# Claude Code ways of working

This page lists the Claude Code techniques the course teaches. Each one links to the step where you use it.
Come back here when you forget how to do one.

For example, you meet plan mode in `run-from-a-label`. Later, in `cap-the-spend`, you use it again, and this
page tells you where you first saw it.

## Drive a session

- **Open Claude Code in a folder, and add another folder.** Run `claude` in the folder you work in. Add
  `--add-dir` to let it read one more folder. See [meet-the-library](../parts/00-meet-the-library/01-meet-the-library/problem/README.md).
- **Sign in and leave.** Type `/login` to sign in and `/exit` to leave. See [Start here](README.md).
- **Ask for a plan in your prompt.** Say "Show me your plan before you change anything". See
  [write-the-issue-form](../parts/01-write-the-work-order/01-write-the-issue-form/problem/README.md).
- **Read the plan, steer it, then say go ahead.** Change the plan with a short reply, then approve it. See
  the same step.
- **Plan mode with Shift+Tab.** Press Shift+Tab until plan mode shows. Claude Code plans and changes no
  file. Press it again to turn plan mode off. See
  [run-from-a-label](../parts/05-run-it-unattended/02-run-from-a-label/problem/README.md).
- **Approve writes under `.claude/`.** Claude Code asks before it writes there. Read the change, then say
  yes. See [add-a-path-rule](../parts/02-teach-the-repo/02-add-a-path-rule/problem/README.md).
- **See how much memory you load.** Type `/context` to see the token count of your memory files. See
  [Teach the repo](../parts/02-teach-the-repo/README.md).

## Teach Claude Code about your repo

- **Memory files: `CLAUDE.md`, `AGENTS.md` and `@` imports.** See
  [trim-the-agents-file](../parts/02-teach-the-repo/01-trim-the-agents-file/problem/README.md).
- **Path rules in `.claude/rules/`.** See
  [add-a-path-rule](../parts/02-teach-the-repo/02-add-a-path-rule/problem/README.md).
- **Skills and the `/triage 6` command.** See
  [package-the-triage-skill](../parts/02-teach-the-repo/03-package-the-triage-skill/problem/README.md).

## Split the work

- **Subagents in `.claude/agents/`, with their own tools and model.** See
  [split-planner-and-builder](../parts/03-split-the-roles/01-split-planner-and-builder/problem/README.md)
  and [build-the-reviewer](../parts/03-split-the-roles/03-build-the-reviewer/problem/README.md).
- **Worktree isolation and `.worktreeinclude`.** See
  [isolate-the-builder](../parts/03-split-the-roles/02-isolate-the-builder/problem/README.md).

## Set the walls

- **Permission deny rules.** See
  [deny-the-shortcuts](../parts/04-gate-the-agent/01-deny-the-shortcuts/problem/README.md).
- **A PreToolUse hook that blocks with exit 2.** See
  [lock-the-tests](../parts/04-gate-the-agent/02-lock-the-tests/problem/README.md).
- **A Stop hook and `stop_hook_active`.** See
  [demand-proof-before-stop](../parts/04-gate-the-agent/03-demand-proof-before-stop/problem/README.md).

## Run without you

- **Headless `claude -p`, with `--max-turns`, `--max-budget-usd`, `--allowedTools` and `--bare`.** A run
  with no permission mode starts in Manual mode and denies anything that would ask you. See
  [run-one-issue-headless](../parts/05-run-it-unattended/01-run-one-issue-headless/problem/README.md).
- **Claude Code in GitHub Actions.** See
  [run-from-a-label](../parts/05-run-it-unattended/02-run-from-a-label/problem/README.md).

## Watch the cost

- **A model alias for each role.** See
  [route-models-by-stage](../parts/06-price-and-ship/01-route-models-by-stage/problem/README.md).
- **Spend caps and `claude setup-token`.** See
  [cap-the-spend](../parts/06-price-and-ship/02-cap-the-spend/problem/README.md).
- **A gateway base URL.** Optional. See
  [track-agent-cost](../parts/07-track-agent-cost/01-track-agent-cost/problem/README.md).
