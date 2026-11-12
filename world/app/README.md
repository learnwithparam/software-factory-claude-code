# Northside lending app

The app the Northside Tool Library desk runs on: a catalogue page, a JSON API and a desk CLI.
It stores everything in one SQLite file built from `seed/`.

## Folders

| Folder | Holds |
|---|---|
| `src/fees/` | late fees and damage charge splits, in integer cents |
| `src/loans/` | due dates and reservations |
| `src/members/` | member search |
| `src/items/` | who may borrow what |
| `src/auth/` | desk roles; protected, a coordinator reviews every change |
| `tests/` | `bun test` runs them; the gate runs them too |
