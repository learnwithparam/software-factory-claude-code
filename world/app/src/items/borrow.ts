import type { Item, Member } from "../db";

export type Decision = { ok: true } | { ok: false; reason: string };

// Can this member take this item home now?
// The member is not read yet. Issue 5 adds the induction rule that reads it.
// biome-ignore lint/correctness/noUnusedFunctionParameters: issue 5 needs this input.
export function canBorrow(member: Member, item: Item): Decision {
  if (item.status === "repair") return { ok: false, reason: `${item.name} is being repaired` };
  if (item.status === "out") return { ok: false, reason: `${item.name} is already out` };
  return { ok: true };
}
