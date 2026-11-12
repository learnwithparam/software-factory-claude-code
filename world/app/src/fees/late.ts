import { daysBetween } from "../loans/dates";

// A loan is late from the morning after its due date. The due date itself is free.
export function lateFeeCents(
  dueDate: string,
  returnedOrToday: string,
  perDayCents: number,
): number {
  const late = daysBetween(dueDate, returnedOrToday);
  return late > 0 ? late * perDayCents : 0;
}
