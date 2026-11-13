// The library's web app: the catalogue the desk volunteers keep open, and a small JSON API.
import { Hono } from "hono";
import { type Item, type Loan, logEvent, open, setting, toMember } from "./db";
import { canBorrow } from "./items/borrow";
import { isOverdue } from "./loans/dates";
import { searchMembers } from "./members/search";

const db = open();
export const app = new Hono();

// A loan that is still out, with the names of its tool and its member.
type LoanOut = Loan & { item: string; member: string };

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

// Names typed by people go into the page, so they must not be able to add their own HTML.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
}

function money(cents: number): string {
  const pounds = cents / 100;
  return `£${pounds.toFixed(2)}`;
}

app.get("/api/items", (context) => {
  const items = db.query("SELECT * FROM items ORDER BY id").all();
  return context.json(items);
});

app.get("/api/loans", (context) => {
  const loans = db.query("SELECT * FROM loans ORDER BY due_date").all();
  return context.json(loans);
});

app.get("/api/members", (context) => {
  const name = context.req.query("q") ?? "";
  const found = searchMembers(db, name);
  logEvent("member_search", { q: name, results: found.length });
  return context.json(found);
});

app.post("/api/loans", async (context) => {
  const { item_id, member_id } = await context.req.json();
  const item = db.query("SELECT * FROM items WHERE id = ?").get(item_id) as Item | null;
  const memberRow = db.query("SELECT * FROM members WHERE id = ?").get(member_id);
  if (!item || !memberRow) {
    return context.json({ ok: false, reason: "no such item or member" }, 404);
  }
  const decision = canBorrow(toMember(memberRow as Record<string, unknown>), item);
  // biome-ignore lint/style/useNamingConvention: the event log uses the database's column names
  logEvent("lend", { item_id, member_id, ...decision });
  let status: 200 | 409 = 409;
  if (decision.ok) {
    status = 200;
  }
  return context.json(decision, status);
});

const STYLE = [
  "body{font-family:system-ui,sans-serif;margin:0;background:#f6f4ef;color:#1f2a24}",
  "header{background:#24493a;color:#fff;padding:16px 24px}" +
    "header h1{margin:0;font-size:22px}header p{margin:4px 0 0;opacity:.85}",
  "main{padding:16px 24px;display:grid;gap:24px;grid-template-columns:3fr 2fr}",
  "section{min-width:0;background:#fff;border-radius:8px;padding:12px 16px}",
  "section{box-shadow:0 1px 2px #0002}",
  "h2{font-size:16px;margin:4px 0 8px}table{border-collapse:collapse;width:100%;font-size:14px}",
  "td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}",
  ".class{padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600}",
  ".class-A{background:#e3f1e7}.class-B{background:#fdf1d6}" +
    ".class-C{background:#f9d9d6;color:#8a1c12}",
  ".status-repair{color:#8a6d00}.status-out{color:#555}",
  ".scroll{overflow-x:auto}",
  "tr.overdue td{color:#b3261e;font-weight:600}",
  "@media (max-width:700px){main{grid-template-columns:1fr}}",
].join("\n");

function headerRow(titles: string[]): string {
  const cells = titles.map((title) => `<th>${title}</th>`);
  return `<tr>${cells.join("")}</tr>`;
}

function safetyBadge(item: Item): string {
  const letter = item.safety_class;
  const label = ["Safety class", letter].join(" ");
  return `<span class="class class-${letter}">${label}</span>`;
}

const STATUS_LABEL: Record<string, string> = {
  in: "Available",
  out: "On loan",
  repair: "In repair",
};

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const name = MONTHS[(month ?? 0) - 1];
  return name ? `${day} ${name} ${year}` : iso;
}

function itemRow(item: Item): string {
  const cells = [
    `<td>${escapeHtml(item.name)}</td>`,
    `<td>${escapeHtml(item.category)}</td>`,
    `<td>${safetyBadge(item)}</td>`,
    `<td>${money(item.deposit_cents)}</td>`,
    `<td class="status-${item.status}">${STATUS_LABEL[item.status] ?? item.status}</td>`,
  ];
  return `<tr>${cells.join("")}</tr>`;
}

function loanRow(loan: LoanOut, today: string): string {
  let rowClass = "";
  let state = "On loan";
  if (isOverdue(loan.due_date, today)) {
    rowClass = "overdue";
    state = "Overdue";
  }
  const cells = [
    `<td>${escapeHtml(loan.item)}</td>`,
    `<td>${escapeHtml(loan.member)}</td>`,
    `<td>${loan.due_date}</td>`,
    `<td>${state}</td>`,
  ];
  return `<tr class="${rowClass}">${cells.join("")}</tr>`;
}

function deskPage(today: string, items: Item[], loans: LoanOut[]): string {
  const summary = `Today is ${longDate(today)}. ${items.length} tools, ${loans.length} on loan.`;
  const catalogueHeader = headerRow(["Tool", "Category", "Safety", "Deposit", "Status"]);
  const itemRows = items.map(itemRow).join("");
  const loanHeader = headerRow(["Tool", "Member", "Due", "Status"]);
  const loanRows = loans.map((loan) => loanRow(loan, today)).join("");
  const loanTable = loans.length
    ? `<div class="scroll"><table>${loanHeader}${loanRows}</table></div>`
    : "<p data-empty-state>Nothing is on loan.</p>";
  const lines = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      "<title>Northside Tool Library</title>",
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<style>",
    STYLE,
    "</style></head><body>",
    `<header><h1>Northside Tool Library</h1><p>${summary}</p></header>`,
    "<main><section><h2>Catalogue</h2>",
    `<div class="scroll"><table>${catalogueHeader}${itemRows}</table></div></section>`,
    `<section><h2>On loan</h2>${loanTable}</section></main>`,
    "</body></html>",
  ];
  return lines.join("\n");
}

app.get("/", (context) => {
  const today = setting(db, "today");
  const items = db.query("SELECT * FROM items ORDER BY category, name").all() as Item[];
  const loansQuery = db.query(
    "SELECT loans.*, items.name AS item, members.name AS member FROM loans " +
      "JOIN items ON items.id = item_id JOIN members ON members.id = member_id " +
      "WHERE returned_date IS NULL ORDER BY due_date",
  );
  const loans = loansQuery.all() as LoanOut[];
  return context.html(deskPage(today, items, loans));
});

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`app: Northside Tool Library is open at http://localhost:${port}`);
}
