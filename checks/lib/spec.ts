// Lint a spec: SPEC.md sections, EARS requirement lines, and a pass list with one entry per requirement.
import { join } from "node:path";
import { json, read, sections } from "./files";

export const SPEC_SECTIONS = [
  "outcome",
  "requirements",
  "must not change",
  "out of scope",
  "done when",
];
// EARS (Easy Approach to Requirements Syntax) keywords. Each requirement opens with one.
export const EARS = /^(when|while|if|where|the system shall)\b/i;

export type PassEntry = {
  id: string;
  requirement: string;
  test_file: string;
  test_name: string;
  passes: boolean;
};

export function requirementLines(spec: string): { id: string; text: string }[] {
  const body = sections(spec).get("requirements") ?? "";
  return body
    .split("\n")
    .map((l) => l.match(/^\s*[-*]\s+\*{0,2}(R\d+)\*{0,2}[.:]?\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ id: m[1], text: m[2].trim() }));
}

export function readSpec(dir: string, issue: number) {
  const specPath = join(dir, "specs", String(issue), "SPEC.md");
  const passPath = join(dir, "specs", String(issue), "passes.json");
  return { spec: read(specPath), passes: json<PassEntry[]>(passPath), specPath, passPath };
}
