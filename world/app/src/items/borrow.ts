import type { Item, Member } from "../db";

export type Decision = { ok: true } | { ok: false; reason: string };

// Can this member take this item home now?
export function canBorrow(member: Member, item: Item): Decision {
  if (item.status === "repair") return { ok: false, reason: `${item.name} is being repaired` };
  if (item.status === "out") return { ok: false, reason: `${item.name} is already out` };
  return { ok: true };
}
