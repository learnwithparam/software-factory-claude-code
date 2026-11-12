# How Claude Code got here: size the backlog

Claude Code reads every issue and the app. You decide if its calls are right. The files in this folder are what it wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Read every issue in ../../../../world/backlog and the app in ../../../../world/app. Then propose one decision for each issue in factory/backlog.json: ready, split or refuse, with a reason. A ready issue also gets an outcome (one sentence a person can check) and files (the 1 to 5 app paths it will change, written as they appear inside world/app). src/auth/ is protected: only a coordinator may change it. Issue 1 is already in the file; follow its shape. Show me your plan before you write the file.
```

## The plan Claude Code showed

This is the real plan from a run with Claude Code 2.1.323 in plan mode.

````text
I've read all seven issues, the coordinator's answers for issue 5, and the app source. Here is the plan; I haven't written `factory/backlog.json` yet.

| # | Decision | Reason | Outcome (ready only) | Files |
|---|---|---|---|---|
| 1 | ready | Kept exactly as it is | - | `README.md` |
| 2 | ready | `splitCharge` rounds every share down and drops the leftover cents. It's a fix to one function. | Splitting D-301 (£33.33) two ways gives £16.67 and £16.66, and the shares of any charge add up to the charge. | `src/fees/split.ts`, `tests/fees/split.test.ts` |
| 3 | ready | `overlaps` only counts a clash when dates strictly overlap. The member keeps the tool through the due date, so bookings that touch on that date should clash too. | Booking drill-01 from the 13th while loan L-101 is due on the 13th is reported as a clash with L-101. | `src/loans/reserve.ts`, `tests/loans/reserve.test.ts` |
| 4 | ready | `searchMembers` returns whole member records, and both the desk CLI and the API pass them on unchanged. | Searching "Ha" at the desk or through `/api/members` shows id and name, but no phone or email. | `src/members/search.ts`, `tests/members/search.test.ts` |
| 5 | ready | The issue is only one line, but the coordinator's answers (`answers/5.json`) give the outcome, the acceptance checks and the scope. The rule belongs in `canBorrow`, not in `src/auth/`. | A member without the class C induction cannot borrow a class C tool, at the desk or through the API, and is told why. | `src/items/borrow.ts`, `tests/items/borrow.test.ts` |
| 6 | refuse | It changes who may waive fees in `src/auth/roles.ts`, which is protected, so a coordinator must decide. | - | - |
| 7 | split | The next Hono major hasn't been released and nobody knows what it breaks. First a spike that lists what breaks, then one issue per break. | - | - |

- **Issue 4 stays small:** changing what `src/members/search.ts` returns fixes both the desk CLI and the API, so neither of those files needs editing.
- **Issue 5 needs no data changes:** members already have an `inductions` field, and the seed data has Ada with the C induction and Ben without, which is what the acceptance checks use.
- **The one call you might want to argue with is issue 5.** If you'd rather judge the issue by its one-line text alone, it would be split, not ready.

If you're happy with this, I'll write the seven entries (issue 1 unchanged) and run `bun run verify size-the-backlog`, which should say `Done. All 8 rules pass.`
````

## What you check in the plan

- Issue 6 is `refuse`, and the reason names `src/auth/`.
- Issue 7 is not `ready`. Nobody knows yet what the upgrade breaks.
- Each `ready` issue names 1 to 5 files, written like `src/fees/split.ts`, not `world/app/src/fees/split.ts`.
- Issue 5 is a judgment call. Claude says so. Its one line is thin, but `answers/5.json` fills it in. You accept `ready`.

## Prompt 2: approve

```text
Go ahead and write factory/backlog.json. Keep issue 1 as it is. Name src/auth/ in the reason of any issue you refuse for it. Then run bun run verify size-the-backlog and tell me what it prints.
```

The check printed `Done. All 8 rules pass.`

## Prompt 3: steer what does not match the plan

Read the file, not only the check. In the real run, the plan said issue 7 is `split`, but the file said `refuse`. The check accepts both. You do not: issue 7 is real work, only too unknown for one run.

```text
Your plan said issue 7 is split, but the file says refuse. Issue 7 is real work that is too unknown for one run, so it is split, not refuse. Change issue 7 to split, with a reason that says what the first smaller issue is. Then run bun run verify size-the-backlog again.
```

The check printed `Done. All 8 rules pass.` again, and issue 7 now says `split`.

## What you reject

- A `ready` issue with no files. The `wrong/no-files-named/` answer shows it.
- Issue 6 marked `ready`. Then the factory edits `src/auth/`. The `wrong/protected-path-ready/` answer shows it.

```bash
bun run verify size-the-backlog solution
```

Expect: `Done. All 8 rules pass.`
