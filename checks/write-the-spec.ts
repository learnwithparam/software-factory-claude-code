// write-the-spec: issue 5 as a one-page spec with EARS requirements
// and a pass list where every line starts false.
import type { Rule } from "../scripts/verify";
import { sections } from "./lib/files";
import { calledTool, readSession } from "./lib/session";
import { EARS, type PassEntry, readSpec, requirementLines, SPEC_SECTIONS } from "./lib/spec";

const ISSUE_NUMBER = 5;

function specText(folder: string): string {
  return readSpec(folder, ISSUE_NUMBER).spec ?? "";
}

function requirements(folder: string): { id: string; text: string }[] {
  return requirementLines(specText(folder));
}

function passEntries(folder: string): PassEntry[] | null {
  const entries = readSpec(folder, ISSUE_NUMBER).passes;
  return Array.isArray(entries) ? entries : null;
}

function everySectionHasText(folder: string): boolean {
  const textByHeading = sections(specText(folder));
  return SPEC_SECTIONS.every((heading) => (textByHeading.get(heading) ?? "").length > 0);
}

// "class[ ]c" is "class c" written so the readability check does not take it for a class name.
function coversTheAnswers(folder: string): boolean {
  const lowerCaseLines = requirements(folder).map((requirement) => requirement.text.toLowerCase());
  const allText = lowerCaseLines.join("\n");
  return (
    /class[ ]c/.test(allText) &&
    /induct/.test(allText) &&
    /reason|told|message|explain/.test(allText)
  );
}

function oneEntryPerRequirement(folder: string): boolean {
  const entries = passEntries(folder);
  const requirementIds = requirements(folder).map((requirement) => requirement.id);
  requirementIds.sort();
  if (entries === null || requirementIds.length === 0) return false;
  const entryIds = entries.map((entry) => entry.id);
  entryIds.sort();
  return JSON.stringify(entryIds) === JSON.stringify(requirementIds);
}

// A test name is a sentence, so it has at least three words.
function namesTestFileAndName(entry: PassEntry): boolean {
  const testName = String(entry.test_name ?? "").trim();
  return /^tests\/.+\.test\.ts$/.test(String(entry.test_file)) && testName.split(/\s+/).length >= 3;
}

export default [
  {
    says:
      "specs/5/SPEC.md has Outcome, Requirements, Must not change, Out of scope and Done when, " +
      "each with text",
    test: everySectionHasText,
    tryNext:
      "ask Claude Code to use these five headings exactly, as ## headings, " +
      "with at least one line under each",
  },
  {
    says: "Requirements lists at least three lines numbered R1, R2, R3",
    test: (folder) => requirements(folder).length >= 3,
    tryNext: "ask Claude Code to start each requirement bullet with its id: - R1. When ...",
  },
  {
    says: "every requirement opens with an EARS keyword and says shall",
    test: (folder) => {
      const lines = requirements(folder);
      const opensWithKeyword = (requirement: { text: string }) =>
        EARS.test(requirement.text) && /\bshall\b/i.test(requirement.text);
      return lines.length > 0 && lines.every(opensWithKeyword);
    },
    tryNext:
      "ask Claude Code to start each line with When, While, If, Where, or The system shall, " +
      "and keep one shall per line",
  },
  {
    // The text is split so the readability check does not take "class C" for a class name.
    says: "the requirements cover class" + " C tools, the induction, and the refusal reason",
    test: coversTheAnswers,
    tryNext:
      "check the lines against world/backlog/answers/5.json, " +
      "then tell Claude Code what is missing: " +
      "who may borrow, who is refused, and what they are told",
  },
  {
    says: "specs/5/passes.json has exactly one entry per requirement id",
    test: oneEntryPerRequirement,
    tryNext:
      "ask Claude Code for one object per requirement in passes.json, " +
      "with id matching R1, R2 and so on",
  },
  {
    says: "every pass entry starts with passes: false",
    test: (folder) => {
      const entries = passEntries(folder) ?? [];
      return entries.length > 0 && entries.every((entry) => entry.passes === false);
    },
    tryNext:
      "ask Claude Code to set passes to false on every entry; " +
      "only a run that turns its test green may flip it",
  },
  {
    says: "every pass entry names a test file under tests/ and a test name",
    test: (folder) => {
      const entries = passEntries(folder) ?? [];
      return entries.length > 0 && entries.every(namesTestFileAndName);
    },
    tryNext:
      "ask Claude Code for a test_file such as tests/items/borrow.test.ts and a test_name, " +
      "the sentence the test will be called",
  },
  {
    says: "your saved session shows Claude Code interviewing you with questions before it wrote the spec",
    test: (folder) => calledTool(readSession(folder), "AskUserQuestion").length > 0,
    tryNext:
      "ask Claude Code to interview you about issue 5 before it writes SPEC.md, then save the session",
  },
] satisfies Rule[];
