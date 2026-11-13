import { expect, test } from "bun:test";
import { splitCharge } from "../../src/fees/split";

test("an even charge splits into equal shares", () => {
  expect(splitCharge(2000, 2)).toEqual([1000, 1000]);
});

test("one borrower pays the whole charge", () => {
  expect(splitCharge(3333, 1)).toEqual([3333]);
});

test("a negative charge is refused", () => {
  expect(() => splitCharge(-1, 2)).toThrow();
});
