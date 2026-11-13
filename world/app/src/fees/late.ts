import { daysBetween } from "../loans/dates";

// A loan is late from the morning after its due date. The due date itself is free.
export function lateFeeCents(
  dueDate: string,
  returnedOrToday: string,
  perDayCents: number,
): number {
  const daysLate = daysBetween(dueDate, returnedOrToday);
  if (daysLate > 0) {
    return daysLate * perDayCents;
  }
  return 0;
}
