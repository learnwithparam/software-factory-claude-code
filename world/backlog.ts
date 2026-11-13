// Reads the library's backlog: one Markdown file per open issue, with a small frontmatter block.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BACKLOG = join(import.meta.dir, "backlog");

export type Issue = {
  number: number;
  title: string;
  // biome-ignore lint/style/useNamingConvention: this is the key the issue files use
  opened_by: string;
  labels: string[];
  body: string;
  file: string;
};

// The frontmatter sits between two --- lines; the body is everything after them.
const FRONTMATTER_AND_BODY = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseIssue(text: string, file = ""): Issue {
  const parts = text.match(FRONTMATTER_AND_BODY);
  if (!parts) throw new Error(`${file}: an issue file starts with a --- frontmatter block`);
  const [, frontmatter, body] = parts;
  const fields = Bun.YAML.parse(frontmatter) as Omit<Issue, "body" | "file">;
  return { ...fields, body: body.trim(), file };
}

function readIssueFile(file: string): Issue {
  const text = readFileSync(join(BACKLOG, file), "utf8");
  return parseIssue(text, file);
}

// Issue files are named like 2-split-loses-a-cent.md; other files in the folder are not issues.
export function issues(): Issue[] {
  const issueFiles = readdirSync(BACKLOG).filter((file) => /^\d+-.*\.md$/.test(file));
  const parsed = issueFiles.map(readIssueFile);
  return parsed.sort((first, second) => first.number - second.number);
}

export function issue(issueNumber: number): Issue {
  const found = issues().find((candidate) => candidate.number === issueNumber);
  if (!found) throw new Error(`there is no issue ${issueNumber} in world/backlog`);
  return found;
}

export function answers(issueNumber: number): Record<string, string> {
  const path = join(BACKLOG, "answers", `${issueNumber}.json`);
  return JSON.parse(readFileSync(path, "utf8")).answers;
}
