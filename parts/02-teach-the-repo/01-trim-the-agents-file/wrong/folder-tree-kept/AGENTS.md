# Instructions for agents

## Where things are

- `src/fees/` holds late fees and damage charge splits.
- `src/loans/` holds due dates and reservations.
- `src/members/` holds member search.
- `src/items/` holds the rule for who may borrow what.
- `tests/` holds the tests.

## Commands

- `bun test` runs every test. Use it while you work.
- `bun run gate` runs every test and records the result. It is the one gate.

## Protected paths

- Never edit anything in `src/auth/`.
- The roles there decide who may waive a fee. A coordinator reviews every change.

## Done when

- `bun run gate` passes on the code as it is now.
