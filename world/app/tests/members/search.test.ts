import { expect, test } from "bun:test";
import { seed } from "../../src/db";
import { searchMembers } from "../../src/members/search";

test("search finds a member by part of their name", () => {
  const db = seed(":memory:");
  const found = searchMembers(db, "Oka");
  expect(found.map((m) => m.name)).toEqual(["Ada Okafor"]);
});
