// Damage charges on a joint loan are shared between the borrowers. Amounts are integer cents.
export function splitCharge(totalCents: number, ways: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error("totalCents must be a whole number of cents");
  if (!Number.isInteger(ways) || ways < 1) throw new Error("ways must be at least 1");
  const share = Math.floor(totalCents / ways);
  return Array.from({ length: ways }, () => share);
}
