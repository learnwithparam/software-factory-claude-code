import { expect, test } from "bun:test";
import { overlaps } from "../../src/loans/reserve";

test("bookings far apart do not clash", () => {
  expect(overlaps({ from: "2026-03-01", to: "2026-03-05" }, { from: "2026-03-10", to: "2026-03-12" })).toBe(false);
});

test("a booking inside another clashes", () => {
  expect(overlaps({ from: "2026-03-01", to: "2026-03-10" }, { from: "2026-03-04", to: "2026-03-06" })).toBe(true);
});
