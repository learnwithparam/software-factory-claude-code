// The library's system of record: one SQLite file, built from world/app/seed by `bun run world`.
//
// The types below use the database's own column names, such as deposit_cents,
// so a row read from SQLite fits them without any renaming.
// biome-ignore-all lint/style/useNamingConvention: these names are the database's column names
import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const WORLD = join(import.meta.dir, "..", "..");
export const DATA = join(WORLD, "data");
export const DB_PATH = process.env.LIBRARY_DB ?? join(DATA, "library.sqlite");
export const EVENTS = join(DATA, "events.jsonl");

const SCHEMA = `
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  joined TEXT NOT NULL,
  inductions TEXT NOT NULL
);
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  safety_class TEXT NOT NULL CHECK (safety_class IN ('A','B','C')),
  deposit_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in','out','repair'))
);
CREATE TABLE loans (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  out_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  returned_date TEXT
);
CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL
);
CREATE TABLE damage_charges (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id),
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL,
  split_between TEXT NOT NULL
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  joined: string;
  inductions: string[];
};
export type Item = {
  id: string;
  name: string;
  category: string;
  safety_class: "A" | "B" | "C";
  deposit_cents: number;
  status: "in" | "out" | "repair";
};
export type Loan = {
  id: string;
  item_id: string;
  member_id: string;
  out_date: string;
  due_date: string;
  returned_date: string | null;
};
// In the database, split_between is one text of member ids joined by commas.
export type DamageCharge = {
  id: string;
  loan_id: string;
  amount_cents: number;
  note: string;
  split_between: string;
};

type Row = Record<string, unknown>;

function readSeedFile(name: string) {
  const path = join(import.meta.dir, "..", "seed", name);
  return JSON.parse(readFileSync(path, "utf8"));
}

// bun:sqlite wants $-prefixed keys for named parameters.
function withNamedParameters(row: Row): Row {
  const entries = Object.entries(row);
  const namedEntries = entries.map(([key, value]) => [`$${key}`, value]);
  return Object.fromEntries(namedEntries);
}

function insertRows(db: Database, sql: string, rows: Row[]) {
  const statement = db.prepare(sql);
  for (const row of rows) {
    statement.run(withNamedParameters(row) as never);
  }
}

// SQLite has no list type, so a list is stored as one text with commas between the parts.
function membersForDatabase(members: Member[]): Row[] {
  return members.map((member) => ({ ...member, inductions: member.inductions.join(",") }));
}

function chargesForDatabase(charges: { split_between: string[] }[]): Row[] {
  return charges.map((charge) => ({ ...charge, split_between: charge.split_between.join(",") }));
}

function insertSeed(db: Database) {
  const book = readSeedFile("loans.json");
  insertRows(
    db,
    "INSERT INTO items VALUES ($id,$name,$category,$safety_class,$deposit_cents,$status)",
    readSeedFile("items.json"),
  );
  insertRows(
    db,
    "INSERT INTO members VALUES ($id,$name,$phone,$email,$joined,$inductions)",
    membersForDatabase(readSeedFile("members.json")),
  );
  insertRows(
    db,
    "INSERT INTO loans VALUES ($id,$item_id,$member_id,$out_date,$due_date,$returned_date)",
    book.loans,
  );
  insertRows(
    db,
    "INSERT INTO reservations VALUES ($id,$item_id,$member_id,$from_date,$to_date)",
    book.reservations,
  );
  insertRows(
    db,
    "INSERT INTO damage_charges VALUES ($id,$loan_id,$amount_cents,$note,$split_between)",
    chargesForDatabase(book.damage_charges),
  );
  insertRows(db, "INSERT INTO settings VALUES ($key,$value)", [
    { key: "today", value: book.today },
    { key: "late_fee_per_day_cents", value: String(book.late_fee_per_day_cents) },
  ]);
}

export function seed(path = DB_PATH): Database {
  mkdirSync(DATA, { recursive: true });
  if (existsSync(path)) {
    unlinkSync(path);
  }
  const db = new Database(path, { create: true });
  db.exec(SCHEMA);
  insertSeed(db);
  return db;
}

export function open(path = DB_PATH): Database {
  if (!existsSync(path)) {
    return seed(path);
  }
  return new Database(path);
}

export function setting(db: Database, key: string): string {
  const query = db.query("SELECT value FROM settings WHERE key = ?");
  const row = query.get(key) as { value: string };
  return row.value;
}

// The inductions column holds text like "B,C"; a member in the app holds a list like ["B", "C"].
export const toMember = (row: Row): Member => {
  let inductions: string[] = [];
  if (row.inductions) {
    inductions = String(row.inductions).split(",");
  }
  return { ...row, inductions } as Member;
};

// Every desk action is logged, so a check can read what happened without asking anyone.
export function logEvent(kind: string, detail: Row) {
  mkdirSync(DATA, { recursive: true });
  appendFileSync(EVENTS, `${JSON.stringify({ kind, ...detail })}\n`);
}
