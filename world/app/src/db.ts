// The library's system of record: one SQLite file, built from world/seed by `bun run world`.
import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const WORLD = join(import.meta.dir, "..", "..");
export const DATA = join(WORLD, "data");
export const DB_PATH = process.env.LIBRARY_DB ?? join(DATA, "library.sqlite");
export const EVENTS = join(DATA, "events.jsonl");

const SCHEMA = `
CREATE TABLE members (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, joined TEXT NOT NULL, inductions TEXT NOT NULL);
CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, safety_class TEXT NOT NULL CHECK (safety_class IN ('A','B','C')), deposit_cents INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('in','out','repair')));
CREATE TABLE loans (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), member_id TEXT NOT NULL REFERENCES members(id), out_date TEXT NOT NULL, due_date TEXT NOT NULL, returned_date TEXT);
CREATE TABLE reservations (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), member_id TEXT NOT NULL REFERENCES members(id), from_date TEXT NOT NULL, to_date TEXT NOT NULL);
CREATE TABLE damage_charges (id TEXT PRIMARY KEY, loan_id TEXT NOT NULL REFERENCES loans(id), amount_cents INTEGER NOT NULL, note TEXT NOT NULL, split_between TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export type Member = { id: string; name: string; phone: string; email: string; joined: string; inductions: string[] };
export type Item = {
  id: string;
  name: string;
  category: string;
  safety_class: "A" | "B" | "C";
  deposit_cents: number;
  status: "in" | "out" | "repair";
};
export type Loan = { id: string; item_id: string; member_id: string; out_date: string; due_date: string; returned_date: string | null };

const seedFile = (name: string) => JSON.parse(readFileSync(join(WORLD, "seed", name), "utf8"));

// bun:sqlite wants $-prefixed keys for named parameters.
const named = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`$${k}`, v]));

export function seed(path = DB_PATH): Database {
  mkdirSync(DATA, { recursive: true });
  if (existsSync(path)) unlinkSync(path);
  const db = new Database(path, { create: true });
  db.exec(SCHEMA);
  const book = seedFile("loans.json");
  const insert = (sql: string, rows: Record<string, unknown>[]) => {
    const q = db.prepare(sql);
    for (const r of rows) q.run(named(r) as never);
  };
  insert("INSERT INTO items VALUES ($id,$name,$category,$safety_class,$deposit_cents,$status)", seedFile("items.json"));
  insert(
    "INSERT INTO members VALUES ($id,$name,$phone,$email,$joined,$inductions)",
    seedFile("members.json").map((m: Member) => ({ ...m, inductions: m.inductions.join(",") })),
  );
  insert("INSERT INTO loans VALUES ($id,$item_id,$member_id,$out_date,$due_date,$returned_date)", book.loans);
  insert("INSERT INTO reservations VALUES ($id,$item_id,$member_id,$from_date,$to_date)", book.reservations);
  insert(
    "INSERT INTO damage_charges VALUES ($id,$loan_id,$amount_cents,$note,$split_between)",
    book.damage_charges.map((d: { split_between: string[] }) => ({ ...d, split_between: d.split_between.join(",") })),
  );
  insert("INSERT INTO settings VALUES ($key,$value)", [
    { key: "today", value: book.today },
    { key: "late_fee_per_day_cents", value: String(book.late_fee_per_day_cents) },
  ]);
  return db;
}

export function open(path = DB_PATH): Database {
  if (!existsSync(path)) return seed(path);
  return new Database(path);
}

export function setting(db: Database, key: string): string {
  return (db.query("SELECT value FROM settings WHERE key = ?").get(key) as { value: string }).value;
}

export const toMember = (r: Record<string, unknown>): Member =>
  ({ ...r, inductions: r.inductions ? String(r.inductions).split(",") : [] }) as Member;

// Every desk action is logged, so a check can read what happened without asking anyone.
export function logEvent(kind: string, detail: Record<string, unknown>) {
  mkdirSync(DATA, { recursive: true });
  appendFileSync(EVENTS, `${JSON.stringify({ kind, ...detail })}\n`);
}
