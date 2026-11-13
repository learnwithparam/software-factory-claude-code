# Instructions for agents

Welcome to the Northside lending app. Please read this whole file before you start any work.

## About the library

The Northside Tool Library is run by its members. It lends drills, ladders, pressure washers and a
chainsaw. Volunteers run the desk on most evenings. The app is how they lend tools and take them back.

## Tech stack

- The app is written in TypeScript.
- It runs on Bun.
- The web server uses Hono.
- The data lives in SQLite, through `bun:sqlite`.
- Tests use `bun:test`.

## Folder layout

```text
world/app/
  README.md
  seed/
    items.json
    loans.json
    members.json
  src/
    auth/
    fees/
    items/
    loans/
    members/
    db.ts
    desk.ts
    server.ts
  tests/
    fees/
    items/
    loans/
    members/
```

## What each folder holds

- `src/` holds the code of the app.
- `src/fees/` holds late fees and damage charge splits.
- `src/loans/` holds due dates and reservations.
- `src/members/` holds member search.
- `src/items/` holds the rule for who may borrow what.
- `src/auth/` holds the desk roles.
- `seed/` holds the data the database is built from.
- `tests/` holds the tests.
- `tests/fees/` holds the tests for fees.
- `tests/loans/` holds the tests for loans.
- `tests/items/` holds the tests for items.
- `tests/members/` holds the tests for member search.

## Important files

- `src/server.ts` is the web server. It serves the catalogue page and the JSON API.
- `src/desk.ts` is the desk tool that volunteers type commands into.
- `src/db.ts` builds the database from the seed files.

## How to write code

- Write clean code.
- Use good names for things.
- Keep functions small.
- Add comments where they help.
- Do not repeat yourself.
- Handle errors well.
- Think before you write.
- Be careful.

## Money

Money is kept in integer cents. That means whole numbers of cents. Never use floats for an amount.
For example, a charge of 33.33 is stored as 3333. The tests for damage splits are in
`tests/fees/split.test.ts`.

## Tests

- Write a test for every change.
- Run the tests often.
- Make sure the tests pass before you finish.

## Git

- Write clear commit messages.
- Keep commits small.
- Do not push to main.

## Commands

- `bun install` installs the packages.
- `bun run app` starts the web app on port 3000.
- `bun run desk overdue` lists the overdue loans.
- `bun test` runs every test.
- `bun run gate` runs every test and records the result. It is the one gate.

## Protected paths

The roles in `src/auth/` decide who may waive a fee. A coordinator reviews every change there. Never edit
anything in `src/auth/`.

## Style

- Use two spaces to indent.
- Use double quotes.
- Keep lines under 100 characters.
- Biome formats the code, so run it before you finish.

## When you are done

The work is done when `bun run gate` passes on the code as it is now. Tell the person what you changed
and why.

## Thank you

Thank you for helping the library. Every fix means a member gets the right tool on time.
