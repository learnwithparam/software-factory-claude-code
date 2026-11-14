# How Claude Code got here: write the spec

Claude Code turns the coordinator's answers into a spec and a pass list. You check each line. The files in this folder are what it wrote in a real run.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

```text
Read specs/3/ as a worked example. Then read issue 5 in ../../../../world/backlog and the coordinator's answers in ../../../../world/backlog/answers/5.json. Write specs/5/SPEC.md in the same shape as specs/3/SPEC.md. Write each requirement as one EARS line that starts with When, While, If, Where or The system shall, numbered R1, R2 and on. Then write specs/5/passes.json with one entry per requirement: id, requirement, test_file, test_name and passes set to false. Show me your plan before you write anything.
```

You can also ask it to interview you, one question at a time. Then you answer from `answers/5.json`.

## The plan Claude Code showed

This is the real plan from a run with Claude Code in plan mode.

```text
I've read everything and written the plan, but I haven't changed either spec file yet.

**What I found**
- `specs/5/SPEC.md` and `specs/5/passes.json` already exist as stubs (one line of text and `[]`). I'll overwrite them.
- The coordinator's answers give the outcome, three acceptance points (Ada can borrow `saw-01`, Ben is refused with a reason that names the induction, class A and B tools are unchanged), what must not change, and what's out of scope.
- The desk (`src/desk.ts:46`) and the API (`src/server.ts:34`) both call `canBorrow` in `src/items/borrow.ts`, so every test can go in `tests/items/borrow.test.ts`.
- The seed data already supports this: Ada has the C induction, Ben has none, and `saw-01` is class C.

**specs/5/SPEC.md** will use the same five sections as specs/3:
- **Outcome:** A member without the class C induction cannot borrow a class C tool, at the desk or through the API, and is told why.
- **Requirements:**
  - R1. When a member with the class C induction borrows a free class C tool, the system shall let the tool go out.
  - R2. When a member without the class C induction borrows a class C tool, the system shall refuse the loan.
  - R3. If a loan of a class C tool is refused for a missing induction, the system shall give a reason that names the class C induction.
  - R4. When any member borrows a free class A or class B tool, the system shall let the tool go out whatever inductions they hold.
  - R5. The system shall apply the same induction check at the desk and through the API.
- **Must not change:** The refusals for a tool in repair or already out keep their wording. Nothing in `src/auth/` changes.
- **Out of scope:** Booking an induction, recording who ran it, and induction expiry.
- **Done when:** Every entry in `passes.json` has its test and each test passes, and `bun run gate` passes.

**specs/5/passes.json** will have five entries. Each has `"passes": false` and `test_file: "tests/items/borrow.test.ts"`:

| id | test_name |
|---|---|
| R1 | an inducted member can borrow the chainsaw |
| R2 | a member without the induction is refused the chainsaw |
| R3 | the refusal reason names the induction |
| R4 | class A and B tools go out without an induction |
| R5 | desk and API refuse the chainsaw the same way |

**Checking it:** from the problem folder, `bun run verify write-the-spec` should print `Done. All 7 rules pass.`

**Decision for you:** R5 comes from "at the desk or through the API" in the outcome. Because both paths already share `canBorrow`, the test for it would be thin. I'd keep it so that nobody adds a second borrow path later that skips the check. If you'd rather stop at R1–R4, the spec still covers class C tools, the induction and the reason the member is told.

Should I go ahead and write both files?
```

## What you check in the plan

- Every requirement opens with When, If or The system shall, and says `shall` once.
- The lines cover class C tools, the induction, and the reason the member is told. For example, R3 names the reason.
- Every pass entry starts with `"passes": false`. Nothing is built yet.
- Claude asks about R5. Both the desk and the API call `canBorrow`, so you stop at R4.

## Prompt 2: approve, with your answer

```text
Go ahead, and stop at R1 to R4: the desk and the API already share canBorrow. Then run bun run verify write-the-spec and tell me what it prints.
```

The check printed `Done. All 7 rules pass.`

## Prompt 3: steer the test file

Read the files, not only the check. In the real run, every entry pointed at a new file, `tests/loans/can-borrow.test.ts`. But `canBorrow` lives in `src/items/borrow.ts`, and its tests are already in `tests/items/borrow.test.ts`.

```text
canBorrow lives in src/items/borrow.ts, and its tests are already in tests/items/borrow.test.ts. Point every passes.json entry at tests/items/borrow.test.ts instead of a new file. Then run bun run verify write-the-spec again.
```

The check printed `Done. All 7 rules pass.` again.

## What you reject

- A pass entry already set to `true`. Only a green test may flip it. The `wrong/passes-already-true/` answer shows it.
- A requirement with no pass entry. The `wrong/missing-pass-entry/` answer shows it.
- Requirements written as plain wishes, like "Inducted members can take class C tools". The `wrong/prose-not-ears/` answer shows it.

```bash
bun run verify write-the-spec solution
```

Expect: `Done. All 7 rules pass.`
