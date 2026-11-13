// Lint a spec: SPEC.md sections, EARS requirement lines,
// and a pass list with one entry per requirement.
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

// biome-ignore-start lint/style/useNamingConvention: passes.json keys are snake_case.
export type PassEntry = {
  id: string;
  requirement: string;
  test_file: string;
  test_name: string;
  passes: boolean;
};
// biome-ignore-end lint/style/useNamingConvention: the passes.json shape ends here.

// A requirement line is a bullet that starts with its id,
// such as "- R1. When ..." or "- **R2**: If ...".
const REQUIREMENT_LINE = /^\s*[-*]\s+\*{0,2}(R\d+)\*{0,2}[.:]?\s+(.*)$/;

export function requirementLines(spec: string): { id: string; text: string }[] {
  const body = sections(spec).get("requirements") ?? "";
  const requirements: { id: string; text: string }[] = [];
  for (const line of body.split("\n")) {
    const parts = line.match(REQUIREMENT_LINE);
    if (parts) requirements.push({ id: parts[1], text: parts[2].trim() });
  }
  return requirements;
}

export function readSpec(folder: string, issue: number) {
  const specPath = join(folder, "specs", String(issue), "SPEC.md");
  const passPath = join(folder, "specs", String(issue), "passes.json");
  return { spec: read(specPath), passes: json<PassEntry[]>(passPath), specPath, passPath };
}
