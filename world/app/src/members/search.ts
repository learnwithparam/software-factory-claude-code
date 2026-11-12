import type { Database } from "bun:sqlite";
import { type Member, toMember } from "../db";

// Desk volunteers find a member by part of their name.
export function searchMembers(db: Database, q: string): Member[] {
  const rows = db
    .query("SELECT * FROM members WHERE name LIKE ? ORDER BY name")
    .all(`%${q}%`) as Record<string, unknown>[];
  return rows.map(toMember);
}
