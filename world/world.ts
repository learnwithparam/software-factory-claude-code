// bun run world          build the library's database if it is missing, then say what is in it
// bun run world reset    throw away every change: rebuild the database, clear the event log and runs/
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DB_PATH, EVENTS, open, seed, setting } from "./app/src/db";
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
const count = (sql: string) => (db.query(sql).get() as { n: number }).n;
const today = setting(db, "today");
const out = db.query("SELECT due_date FROM loans WHERE returned_date IS NULL").all() as { due_date: string }[];
const late = out.filter((l) => isOverdue(l.due_date, today)).length;
console.log(
  `world: ${reset ? "reset to the seed. " : ""}Northside Tool Library is ready: ${count("SELECT COUNT(*) AS n FROM items")} tools, ${count("SELECT COUNT(*) AS n FROM members")} members, ${out.length} loans out (${late} overdue), ${issues().length} open issues.`,
);
