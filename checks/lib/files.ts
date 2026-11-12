// Read what the learner produced: files, YAML, JSON, Markdown sections and frontmatter.
// A reader never throws on a missing file; it returns null so a rule can say what is missing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function read(path: string): string | null {
  if (existsSync(path) && statSync(path).isFile()) return readFileSync(path, "utf8");
  return null;
}

export function json<T = unknown>(path: string): T | null {
  const text = read(path);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function yaml<T = unknown>(path: string): T | null {
  const text = read(path);
  if (text === null) return null;
  try {
    return Bun.YAML.parse(text) as T;
  } catch {
    return null;
  }
}

// A Markdown file with a --- frontmatter block, as skills, agents and path rules use.
export function frontmatter(path: string): { data: Record<string, unknown>; body: string } | null {
  const text = read(path);
  const parts = text?.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!parts) return null;
  try {
    const data = Bun.YAML.parse(parts[1]);
    if (!data || typeof data !== "object") return null;
    return { data: data as Record<string, unknown>, body: parts[2] };
  } catch {
    return null;
  }
}

// "## Outcome" and the text under it, keyed by heading text in lower case.
// Any heading level counts. A "#" line inside a ``` code block is not a heading.
export function sections(markdown: string): Map<string, string> {
  const textByHeading = new Map<string, string>();
  let currentHeading: string | null = null;
  let linesUnderHeading: string[] = [];
  let insideCodeBlock = false;
  const saveCurrentSection = () => {
    if (currentHeading === null) return;
    textByHeading.set(currentHeading, linesUnderHeading.join("\n").trim());
  };
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) insideCodeBlock = !insideCodeBlock;
    const heading = insideCodeBlock ? null : line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      saveCurrentSection();
      currentHeading = heading[1].toLowerCase();
      linesUnderHeading = [];
    } else {
      linesUnderHeading.push(line);
    }
  }
  saveCurrentSection();
  return textByHeading;
}

export function nonEmptyLines(text: string): string[] {
  const trimmedLines = text.split("\n").map((line) => line.trim());
  return trimmedLines.filter(Boolean);
}

// Every file under a folder, as a path relative to the folder it started from.
export function listFiles(folder: string, startFolder = folder): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return listFiles(path, startFolder);
    return [path.slice(startFolder.length + 1)];
  });
}
