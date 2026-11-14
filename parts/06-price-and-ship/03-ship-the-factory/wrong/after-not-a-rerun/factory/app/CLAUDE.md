# Northside lending app

The desk app of a member-run tool library. TypeScript on Bun, `bun:sqlite`, Hono.

## Commands

- `bun run gate` runs every test and records the result in `.factory/gate.json`. It is the one gate.
- `bun test tests/<area>` runs one area's tests while you work.

## Rules

- Money is integer cents. Never use floats for an amount.
- `src/auth/` is protected. A coordinator reviews every change there, so the factory never edits it.
- In the build stage the tests are locked: they say what the issue asks for. Change `src/` until they pass.

## Done when

`bun run gate` exits 0 on the code as it is now.
