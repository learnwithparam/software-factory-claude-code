export type Range = { from: string; to: string };

// run 5: ignore a range with no start date
const hasStart = (range: Range) => range.from !== "";

// run 3: dates are inclusive, because a loan holds the tool through its due date
export function overlaps(first: Range, second: Range): boolean {
  return hasStart(first) && hasStart(second) && first.from <= second.to && second.from <= first.to;
}
