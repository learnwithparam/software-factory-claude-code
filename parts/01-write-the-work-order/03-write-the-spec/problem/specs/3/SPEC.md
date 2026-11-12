# Issue 3: a pickup on another loan's due date is a clash

This is a worked example. Read it, then write `specs/5/SPEC.md` the same way.

## Outcome

A reservation that shares any date with an open loan or another reservation of the same item is refused.

## Requirements

- R1. When a reservation starts on the due date of an open loan of the same item, the system shall report a clash.
- R2. When two reservations of one item share their first or last date, the system shall report a clash.
- R3. If two bookings of one item share no date, the system shall report no clash.

## Must not change

The meaning of a due date: the member keeps the tool through it. Late fees and `isOverdue` stay as they are.

## Out of scope

Showing clashes on the web page. Moving or cancelling a reservation.

## Done when

- Every entry in `passes.json` has its test, and each test passes.
- `bun run gate` passes.
