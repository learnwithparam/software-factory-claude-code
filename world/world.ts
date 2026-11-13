// bun run world          build the library's database if it is missing, then say what is in it
// bun run world reset    throw away every change:
//                        rebuild the database, clear the event log and runs/
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DB_PATH, EVENTS, type Loan, open, seed, setting } from "./app/src/db";
import { isOverdue } from "./app/src/loans/dates";
import { issues } from "./backlog";

const ROOT = join(import.meta.dir, "..");
const reset = process.argv[2] === "reset";

if (reset) {
  seed();
  rmSync(EVENTS, { force: true });
  rmSync(join(ROOT, "runs"), { recursive: true, force: true });
} else if (!existsSync(DB_PATH)) {
  seed();
}

const db = open();

function countRows(table: string): number {
  const row = db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

const today = setting(db, "today");
const loansOutQuery = db.query("SELECT due_date FROM loans WHERE returned_date IS NULL");
const loansOut = loansOutQuery.all() as Pick<Loan, "due_date">[];
const overdueLoans = loansOut.filter((loan) => isOverdue(loan.due_date, today));

let opening = "";
if (reset) {
  opening = "reset to the seed. ";
}
const tools = `${countRows("items")} tools`;
const members = `${countRows("members")} members`;
const loans = `${loansOut.length} loans out (${overdueLoans.length} overdue)`;
const openIssues = `${issues().length} open issues`;
const contents = `${tools}, ${members}, ${loans}, ${openIssues}`;
console.log(`world: ${opening}Northside Tool Library is ready: ${contents}.`);
