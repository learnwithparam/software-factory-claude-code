// Dates are plain ISO strings (YYYY-MM-DD). The library is in one place, so there are no time zones.
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// The member keeps the tool through the due date: a loan due on the 13th is still theirs on the 13th.
export function isOverdue(dueDate: string, today: string): boolean {
  return today > dueDate;
}
