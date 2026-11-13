# Issue 5: only inducted members borrow class C tools

## Outcome

A member without the class C induction cannot borrow a class C tool, at the desk or through the API, and is told why. Both paths go through `canBorrow`, so one rule there covers both.

## Requirements

- R1. When a member with the class C induction asks to borrow a class C tool, the system shall allow the loan.
- R2. When a member without the class C induction asks to borrow a class C tool, the system shall refuse the loan.
- R3. If a class C loan is refused for a missing induction, the system shall give the member a reason that names the induction.
- R4. When any member asks to borrow a class A or class B tool, the system shall decide the loan exactly as it did before this change.

## Must not change

The wording of the repair and already-out refusals. Nothing in `src/auth/`.

## Out of scope

Booking an induction, recording who ran it, and induction expiry.

## Done when

- Every entry in `passes.json` has its test, and each test passes: Ada Okafor (inducted) borrows saw-01, Ben Halloran (not inducted) is refused saw-01 with a reason naming the induction, and class A and B tools behave as before.
- `bun run gate` passes.
