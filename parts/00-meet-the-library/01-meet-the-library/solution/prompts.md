# How Claude Code got here: meet the library

You type every line. Claude Code reads the world and writes the file. Your job is the judgment.

Start Claude Code in this step's `problem/` folder, so it can also read the world:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask, do not change

```text
Read the seven issues in ../../../../world/backlog and the code they touch in ../../../../world/app. Which issue is a factory most likely to get wrong when no person watches it? Give me your top two, each with one reason that names what would fool the agent. Do not change any file.
```

## What Claude Code answered

This is the real answer from a run with Claude Code 2.1.323 in plan mode. Your answer will use other words.

```text
I'd pick #6 first and #4 second. I changed no files.

**1. #6 "Let desk volunteers waive any fee"**

The issue itself names the file to change: "The rule lives in `src/auth/roles.ts`." The fix is one line. You delete `return amountCents <= 200` and return true, and no test covers `roles.ts`, so `bun run gate` still passes. The agent sees a precise, polite request, an easy diff and a passing gate, and treats them as permission. But `src/auth/` is protected (app README and the factory's `CLAUDE.md`: "the factory never edits it"), and the issue asks to remove a money control. The right result is to stop and pass it to a coordinator, not to ship a fix. Without a person watching, nothing stops it except a rule the agent has to remember on its own.

**2. #4 "Member search shows other members' phone numbers"**

The existing test fools it. `tests/members/search.test.ts` only checks `found.map(m => m.name)`, so it passes whether or not phone and email leak. The data also reaches the screen two ways: `desk.ts` prints `JSON.stringify(m)`, and `server.ts` `/api/members` returns `c.json(found)`. Both come from `SELECT *` in `src/members/search.ts`. An agent that reads the issue as "the desk screen" may hide the fields in the desk CLI output only, see green tests, and stop while the API still serves every phone number and email. The real fix is in `searchMembers` itself, plus a test that checks the fields are gone.

Runner-up: #5 "Chainsaw rule". The title and body say "chainsaw", so an agent may block by item name or `saw-01`. The coordinator's answers in `backlog/answers/5.json` say the rule covers every class C tool, which also includes the circular saw `saw-02`. That one is easier to catch, though: once the answers are written into tests, a name-only rule fails them.
```

## What you check

- It changed no file. You asked it not to.
- Each reason names something real. For example, it quotes `tests/members/search.test.ts` and `SELECT *`. Open those files and see that they say what it claims.
- You do not have to agree. The pick is yours.

In this sample, you pick issue 3, not 6 or 4. Issue 6 names a protected folder, so a rule can stop it. Issue 3 hides in a date: a loan due on the 13th and a pickup on the 13th look free.

## Prompt 2: write your pick

```text
Add one line to notes/goal.md, below the comment. Write my pick, not yours: Issue 3, because a pickup on the due date looks like a free date and a test with far-apart dates still passes. Change nothing else.
```

Claude Code answered: "I added your pick to `notes/goal.md` on the line below the comment, in your words."

## What you reject

- A line in Claude's words, not yours. The check cannot see this, but the step is about your own guess.
- A line with no issue number, like "The one about money". The `wrong/no-issue-named/` answer shows it.
- A line with no reason, like "Issue 4." The `wrong/no-reason/` answer shows it.

```bash
bun run verify meet-the-library
```

Expect: `Done. All 5 rules pass.`
