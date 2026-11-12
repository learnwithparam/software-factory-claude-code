import { expect, test } from "bun:test";
import type { Item, Member } from "../../src/db";
import { canBorrow } from "../../src/items/borrow";

const member: Member = {
  id: "m-1",
  name: "Test",
  phone: "",
  email: "",
  joined: "2026-01-01",
  inductions: [],
};
const ladder: Item = {
  id: "ladder-01",
  name: "Step ladder",
  category: "access",
  safety_class: "A",
  deposit_cents: 1000,
  status: "in",
};

test("a free class A tool can go out", () => {
  expect(canBorrow(member, ladder)).toEqual({ ok: true });
});

test("a tool in repair cannot go out", () => {
  expect(canBorrow(member, { ...ladder, status: "repair" }).ok).toBe(false);
});
