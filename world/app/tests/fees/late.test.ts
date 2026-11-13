import { expect, test } from "bun:test";
import { lateFeeCents } from "../../src/fees/late";

test("returned on the due date costs nothing", () => {
  expect(lateFeeCents("2026-03-06", "2026-03-06", 50)).toBe(0);
});

test("four nights late costs four times the rate", () => {
  expect(lateFeeCents("2026-03-06", "2026-03-10", 50)).toBe(200);
});
