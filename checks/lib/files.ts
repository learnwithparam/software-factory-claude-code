// Read what the learner produced: files, YAML, JSON, Markdown sections and frontmatter.
// A reader never throws on a missing file; it returns null so a rule can say what is missing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const read = (path: string): string | null =>
  existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : null;

export function json<T = unknown>(path: string): T | null {
  const t = read(path);
  if (t === null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export function yaml<T = unknown>(path: string): T | null {
  const t = read(path);
  if (t === null) return null;
  try {
    return Bun.YAML.parse(t) as T;
  } catch {
    return null;
  }
}

// A Markdown file with a --- frontmatter block, as skills, agents and path rules use.
export function frontmatter(path: string): { data: Record<string, unknown>; body: string } | null {
  const t = read(path);
  const m = t?.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  try {
    const data = Bun.YAML.parse(m[1]);
    return data && typeof data === "object"
      ? { data: data as Record<string, unknown>, body: m[2] }
      : null;
  } catch {
    return null;
  }
}

// "## Outcome" and the text under it, keyed by heading text in lower case. Any heading level counts.
export function sections(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  let current: string | null = null;
  let buf: string[] = [];
  let fence = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) fence = !fence;
    const h = !fence && line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (h) {
      if (current !== null) out.set(current, buf.join("\n").trim());
      current = h[1].toLowerCase();
      buf = [];
    } else buf.push(line);
  }
  if (current !== null) out.set(current, buf.join("\n").trim());
  return out;
}

export const nonEmptyLines = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? listFiles(p, base) : [p.slice(base.length + 1)];
  });
}
