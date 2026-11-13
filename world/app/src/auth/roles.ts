// Who may do what at the desk.
// This folder is protected: a change here needs a coordinator's review.
export type Role = "desk" | "coordinator";

export function canWaiveFee(role: Role, amountCents: number): boolean {
  if (role === "coordinator") return true;
  return amountCents <= 200;
}
