import type { Database } from "bun:sqlite";

export type Range = { from: string; to: string };
type Booking = Range & { id: string };

// Two bookings of one item clash when their date ranges share any date.
export function overlaps(first: Range, second: Range): boolean {
  return first.from < second.to && second.from < first.to;
}

export function clashes(db: Database, itemId: string, wanted: Range): string[] {
  const loansQuery = db.query(
    "SELECT id, out_date AS 'from', due_date AS 'to' FROM loans " +
      "WHERE item_id = ? AND returned_date IS NULL",
  );
  const loans = loansQuery.all(itemId) as Booking[];
  const reservationsQuery = db.query(
    "SELECT id, from_date AS 'from', to_date AS 'to' FROM reservations WHERE item_id = ?",
  );
  const reservations = reservationsQuery.all(itemId) as Booking[];
  const bookings = [...loans, ...reservations];
  const clashing = bookings.filter((booking) => overlaps(booking, wanted));
  return clashing.map((booking) => booking.id);
}
