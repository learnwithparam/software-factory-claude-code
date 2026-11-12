// Reads the library's backlog: one Markdown file per open issue, with a small frontmatter block.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BACKLOG = join(import.meta.dir, "backlog");

export type Issue = {
  number: number;
  title: string;
  opened_by: string;
  labels: string[];
  body: string;
  file: string;
};

export function parseIssue(text: string, file = ""): Issue {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: an issue file starts with a --- frontmatter block`);
  const meta = Bun.YAML.parse(m[1]) as Omit<Issue, "body" | "file">;
  return { ...meta, body: m[2].trim(), file };
}

export function issues(): Issue[] {
  return readdirSync(BACKLOG)
    .filter((f) => /^\d+-.*\.md$/.test(f))
    .map((f) => parseIssue(readFileSync(join(BACKLOG, f), "utf8"), f))
    .sort((a, b) => a.number - b.number);
}

export function issue(n: number): Issue {
  const found = issues().find((i) => i.number === n);
  if (!found) throw new Error(`there is no issue ${n} in world/backlog`);
  return found;
}

export function answers(n: number): Record<string, string> {
  return JSON.parse(readFileSync(join(BACKLOG, "answers", `${n}.json`), "utf8")).answers;
}
