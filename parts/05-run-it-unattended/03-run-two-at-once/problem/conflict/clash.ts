export type Range = { from: string; to: string };

<<<<<<< main (run 3 merged first: dates are inclusive)
export function overlaps(first: Range, second: Range): boolean {
  return first.from <= second.to && second.from <= first.to;
}
=======
// run 5 (rebasing now): ignore a range with no start date
const hasStart = (range: Range) => range.from !== "";

export function overlaps(first: Range, second: Range): boolean {
  return hasStart(first) && hasStart(second) && first.from < second.to && second.from < first.to;
}
>>>>>>> factory/issue-5
