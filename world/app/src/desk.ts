// The desk CLI volunteers use when the web page is too slow.
//   bun run desk overdue          loans past their due date
//   bun run desk search <name>    find a member
//   bun run desk lend <item> <member>
//   bun run desk split <charge-id>  share a damage charge between its borrowers
import { type Item, logEvent, open, setting, toMember } from "./db";
import { lateFeeCents } from "./fees/late";
import { splitCharge } from "./fees/split";
import { canBorrow } from "./items/borrow";
import { isOverdue } from "./loans/dates";
import { searchMembers } from "./members/search";

const db = open();
const [cmd, ...args] = process.argv.slice(2);
const today = setting(db, "today");
const perDay = Number(setting(db, "late_fee_per_day_cents"));
const money = (cents: number) => `£${(cents / 100).toFixed(2)}`;

if (cmd === "overdue") {
  const rows = db
    .query(
      "SELECT loans.*, items.name AS item FROM loans JOIN items ON items.id = item_id WHERE returned_date IS NULL",
    )
    .all() as { id: string; item: string; due_date: string }[];
  const late = rows.filter((r) => isOverdue(r.due_date, today));
  for (const r of late)
    console.log(
      `${r.id}  ${r.item}  due ${r.due_date}  fee so far ${money(lateFeeCents(r.due_date, today, perDay))}`,
    );
  console.log(`desk: ${late.length} overdue loan(s)`);
} else if (cmd === "search") {
  const found = searchMembers(db, args.join(" "));
  logEvent("member_search", { q: args.join(" "), results: found.length });
  for (const m of found) console.log(JSON.stringify(m));
  console.log(`desk: ${found.length} member(s) found`);
} else if (cmd === "lend") {
  const item = db.query("SELECT * FROM items WHERE id = ?").get(args[0]) as Item | null;
  const row = db.query("SELECT * FROM members WHERE id = ?").get(args[1]) as Record<
    string,
    unknown
  > | null;
  if (!item || !row) {
    console.log("desk: no such item or member");
    process.exit(1);
  }
  const d = canBorrow(toMember(row), item);
  logEvent("lend", { item_id: args[0], member_id: args[1], ...d });
  console.log(d.ok ? `desk: ${item.name} can go out` : `desk: refused, ${d.reason}`);
} else if (cmd === "split") {
  const charge = db.query("SELECT * FROM damage_charges WHERE id = ?").get(args[0]) as {
    amount_cents: number;
    split_between: string;
  } | null;
  if (!charge) {
    console.log("desk: no such damage charge");
    process.exit(1);
  }
  const who = charge.split_between.split(",");
  const shares = splitCharge(charge.amount_cents, who.length);
  who.forEach((m, i) => console.log(`${m}  ${money(shares[i])}`));
  const total = shares.reduce((a, b) => a + b, 0);
  console.log(`desk: charge ${money(charge.amount_cents)}, shares add up to ${money(total)}`);
} else {
  console.log("desk: commands are overdue, search <name>, lend <item> <member>, split <charge-id>");
}
