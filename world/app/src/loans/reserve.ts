import type { Database } from "bun:sqlite";

export type Range = { from: string; to: string };

// Two bookings of one item clash when their date ranges share any date.
export function overlaps(a: Range, b: Range): boolean {
  return a.from < b.to && b.from < a.to;
}

export function clashes(db: Database, itemId: string, wanted: Range): string[] {
  const loans = db
    .query(
      "SELECT id, out_date AS 'from', due_date AS 'to' FROM loans WHERE item_id = ? AND returned_date IS NULL",
    )
    .all(itemId) as (Range & { id: string })[];
  const held = db
    .query("SELECT id, from_date AS 'from', to_date AS 'to' FROM reservations WHERE item_id = ?")
    .all(itemId) as (Range & { id: string })[];
  return [...loans, ...held].filter((b) => overlaps(b, wanted)).map((b) => b.id);
}
