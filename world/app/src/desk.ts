// The desk CLI volunteers use when the web page is too slow.
//   bun run desk overdue          loans past their due date
//   bun run desk search <name>    find a member
//   bun run desk lend <item> <member>
//   bun run desk split <charge-id>  share a damage charge between its borrowers
import { type DamageCharge, type Item, type Loan, logEvent, open, setting, toMember } from "./db";
import { lateFeeCents } from "./fees/late";
import { splitCharge } from "./fees/split";
import { canBorrow } from "./items/borrow";
import { isOverdue } from "./loans/dates";
import { searchMembers } from "./members/search";

const db = open();
const [command, ...args] = process.argv.slice(2);
const today = setting(db, "today");
const lateFeePerDayCents = Number(setting(db, "late_fee_per_day_cents"));

function money(cents: number): string {
  const pounds = cents / 100;
  return `£${pounds.toFixed(2)}`;
}

function showOverdueLoans() {
  const query = db.query(
    "SELECT loans.*, items.name AS item FROM loans " +
      "JOIN items ON items.id = item_id WHERE returned_date IS NULL",
  );
  const loansOut = query.all() as (Loan & { item: string })[];
  const lateLoans = loansOut.filter((loan) => isOverdue(loan.due_date, today));
  for (const loan of lateLoans) {
    const fee = lateFeeCents(loan.due_date, today, lateFeePerDayCents);
    console.log(`${loan.id}  ${loan.item}  due ${loan.due_date}  fee so far ${money(fee)}`);
  }
  console.log(`desk: ${lateLoans.length} overdue loan(s)`);
}

function showMembersNamed(name: string) {
  const found = searchMembers(db, name);
  logEvent("member_search", { q: name, results: found.length });
  for (const member of found) {
    console.log(JSON.stringify(member));
  }
  console.log(`desk: ${found.length} member(s) found`);
}

function lend(itemId: string, memberId: string) {
  const item = db.query("SELECT * FROM items WHERE id = ?").get(itemId) as Item | null;
  const memberRow = db.query("SELECT * FROM members WHERE id = ?").get(memberId);
  if (!item || !memberRow) {
    console.log("desk: no such item or member");
    process.exit(1);
  }
  const decision = canBorrow(toMember(memberRow as Record<string, unknown>), item);
  // biome-ignore lint/style/useNamingConvention: the event log uses the database's column names
  logEvent("lend", { item_id: itemId, member_id: memberId, ...decision });
  if (decision.ok) {
    console.log(`desk: ${item.name} can go out`);
  } else {
    console.log(`desk: refused, ${decision.reason}`);
  }
}

function showSplit(chargeId: string) {
  const query = db.query("SELECT * FROM damage_charges WHERE id = ?");
  const charge = query.get(chargeId) as DamageCharge | null;
  if (!charge) {
    console.log("desk: no such damage charge");
    process.exit(1);
  }
  const borrowers = charge.split_between.split(",");
  const shares = splitCharge(charge.amount_cents, borrowers.length);
  for (let i = 0; i < borrowers.length; i++) {
    console.log(`${borrowers[i]}  ${money(shares[i])}`);
  }
  const total = shares.reduce((sum, share) => sum + share, 0);
  console.log(`desk: charge ${money(charge.amount_cents)}, shares add up to ${money(total)}`);
}

if (command === "overdue") {
  showOverdueLoans();
} else if (command === "search") {
  showMembersNamed(args.join(" "));
} else if (command === "lend") {
  lend(args[0], args[1]);
} else if (command === "split") {
  showSplit(args[0]);
} else {
  console.log("desk: commands are overdue, search <name>, lend <item> <member>, split <charge-id>");
}
