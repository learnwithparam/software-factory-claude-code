# Instructions for agents

## Commands

- `bun install` installs the packages.
- `bun run app` starts the web app on port 3000.
- `bun run desk overdue` lists the overdue loans.
- `bun test` runs every test. Use it while you work.
- `bun run gate` runs every test and records the result. It is the one gate.

## Protected paths

- Never edit anything in `src/auth/`.
- The roles there decide who may waive a fee. A coordinator reviews every change.

## Done when

- `bun run gate` passes on the code as it is now.
- You tell the person what you changed and why.
