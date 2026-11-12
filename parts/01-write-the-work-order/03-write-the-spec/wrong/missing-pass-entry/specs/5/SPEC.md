# Issue 5: class C tools need the class C induction

## Outcome

A member without the class C induction cannot borrow a class C tool, at the desk or through the API, and is told why.

## Requirements

- R1. When a member with the class C induction asks for a free class C tool, the system shall allow the loan.
- R2. When a member without the class C induction asks for a class C tool, the system shall refuse the loan with a reason that names the class C induction.
- R3. When any member asks for a free class A or class B tool, the system shall decide exactly as it did before this change.
- R4. If a class C tool is in repair or already out, the system shall refuse it with the same reason as before, whatever the member's inductions.

## Must not change

The wording of the repair and already-out refusals. Nothing under `src/auth/`.

## Out of scope

Booking an induction, recording who ran it, and induction expiry.

## Done when

- Every entry in `passes.json` has its test in `tests/items/borrow.test.ts`, and each test passes.
- `bun run desk lend saw-01 m-002` prints a refusal that names the induction.
- `bun run gate` passes.
