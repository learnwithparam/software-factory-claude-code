// The library's web app: the catalogue the desk volunteers keep open, and a small JSON API.
import { Hono } from "hono";
import { type Item, type Loan, logEvent, open, setting, toMember } from "./db";
import { canBorrow } from "./items/borrow";
import { isOverdue } from "./loans/dates";
import { searchMembers } from "./members/search";

const db = open();
export const app = new Hono();

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
const money = (cents: number) => `£${(cents / 100).toFixed(2)}`;

app.get("/api/items", (c) => c.json(db.query("SELECT * FROM items ORDER BY id").all()));
app.get("/api/loans", (c) => c.json(db.query("SELECT * FROM loans ORDER BY due_date").all()));
app.get("/api/members", (c) => {
  const q = c.req.query("q") ?? "";
  const found = searchMembers(db, q);
  logEvent("member_search", { q, results: found.length });
  return c.json(found);
});
app.post("/api/loans", async (c) => {
  const { item_id, member_id } = await c.req.json();
  const item = db.query("SELECT * FROM items WHERE id = ?").get(item_id) as Item | null;
  const row = db.query("SELECT * FROM members WHERE id = ?").get(member_id) as Record<
    string,
    unknown
  > | null;
  if (!item || !row) return c.json({ ok: false, reason: "no such item or member" }, 404);
  const decision = canBorrow(toMember(row), item);
  logEvent("lend", { item_id, member_id, ...decision });
  return c.json(decision, decision.ok ? 200 : 409);
});

app.get("/", (c) => {
  const today = setting(db, "today");
  const items = db.query("SELECT * FROM items ORDER BY category, name").all() as Item[];
  const loans = db
    .query(
      "SELECT loans.*, items.name AS item, members.name AS member FROM loans JOIN items ON items.id = item_id JOIN members ON members.id = member_id WHERE returned_date IS NULL ORDER BY due_date",
    )
    .all() as (Loan & { item: string; member: string })[];
  const itemRows = items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}</td><td>${esc(i.category)}</td><td><span class="class class-${i.safety_class}">class ${i.safety_class}</span></td><td>${money(i.deposit_cents)}</td><td class="status-${i.status}">${i.status}</td></tr>`,
    )
    .join("");
  const loanRows = loans
    .map((l) => {
      const late = isOverdue(l.due_date, today);
      return `<tr class="${late ? "overdue" : ""}"><td>${esc(l.item)}</td><td>${esc(l.member)}</td><td>${l.due_date}</td><td>${late ? "overdue" : "on loan"}</td></tr>`;
    })
    .join("");
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Northside Tool Library</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#f6f4ef;color:#1f2a24}
header{background:#24493a;color:#fff;padding:16px 24px}header h1{margin:0;font-size:22px}header p{margin:4px 0 0;opacity:.85}
main{padding:16px 24px;display:grid;gap:24px;grid-template-columns:3fr 2fr}
section{background:#fff;border-radius:8px;padding:12px 16px;box-shadow:0 1px 2px #0002}
h2{font-size:16px;margin:4px 0 8px}table{border-collapse:collapse;width:100%;font-size:14px}
td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
.class{padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600}
.class-A{background:#e3f1e7}.class-B{background:#fdf1d6}.class-C{background:#f9d9d6;color:#8a1c12}
.status-repair{color:#8a6d00}.status-out{color:#555}
tr.overdue td{color:#b3261e;font-weight:600}
@media (max-width:700px){main{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Northside Tool Library</h1><p>Desk view. Today is ${today}. ${items.length} tools, ${loans.length} on loan.</p></header>
<main><section><h2>Catalogue</h2><table><tr><th>Tool</th><th>Category</th><th>Safety</th><th>Deposit</th><th>Status</th></tr>${itemRows}</table></section>
<section><h2>On loan</h2><table><tr><th>Tool</th><th>Member</th><th>Due</th><th></th></tr>${loanRows}</table></section></main>
</body></html>`);
});

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`app: Northside Tool Library is open at http://localhost:${port}`);
}
