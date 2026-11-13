// Dates are plain ISO strings (YYYY-MM-DD).
// The library is in one place, so there are no time zones.
const MILLISECONDS_IN_A_DAY = 86_400_000;

export function daysBetween(from: string, until: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  return Math.round((end - start) / MILLISECONDS_IN_A_DAY);
}

// The member keeps the tool through the due date:
// a loan due on the 13th is still theirs on the 13th.
export function isOverdue(dueDate: string, today: string): boolean {
  return today > dueDate;
}
