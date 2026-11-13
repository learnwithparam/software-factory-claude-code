# Instructions for Claude

This file repeats the main points of AGENTS.md, so Claude sees them first.

## Folder layout

- `src/fees/` holds late fees and damage charge splits.
- `src/loans/` holds due dates and reservations.
- `src/members/` holds member search.
- `src/items/` holds the rule for who may borrow what.
- `src/auth/` holds the desk roles.
- `tests/` holds the tests.

## Commands

- `bun test` runs every test.
- `bun run gate` runs every test and records the result.

## Rules

- Money is kept in integer cents.
- Never edit anything in `src/auth/`.
- Write clean code and be careful.
