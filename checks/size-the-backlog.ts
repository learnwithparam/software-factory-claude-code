// size-the-backlog: a decision for every open issue.
// Ready means one outcome and at most five named files.
// Work in a protected path is refused. A major upgrade is never ready as one piece.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json } from "./lib/files";
import { appFiles, issues, PROTECTED } from "./lib/world";

type Entry = {
  issue: number;
  decision: string;
  reason?: string;
  outcome?: string;
  files?: string[];
};

function backlog(folder: string): Entry[] | null {
  const entries = json<Entry[]>(join(folder, "factory", "backlog.json"));
  return Array.isArray(entries) ? entries : null;
}

function entryFor(folder: string, issueNumber: number): Entry | undefined {
  return backlog(folder)?.find((entry) => entry.issue === issueNumber);
}

function readyEntries(folder: string): Entry[] {
  return (backlog(folder) ?? []).filter((entry) => entry.decision === "ready");
}

function wordCount(text?: string): number {
  const words = (text ?? "").trim().split(/\s+/);
  return words.filter(Boolean).length;
}

function namesOneToFiveFiles(entry: Entry): boolean {
  return Array.isArray(entry.files) && entry.files.length >= 1 && entry.files.length <= 5;
}

function isProtected(path: string): boolean {
  return PROTECTED.some((protectedPath) => path.startsWith(protectedPath));
}

function everyIssueHasOneEntry(folder: string): boolean {
  const entryNumbers = (backlog(folder) ?? []).map((entry) => entry.issue);
  entryNumbers.sort((first, second) => first - second);
  const issueNumbers = issues().map((backlogIssue) => backlogIssue.number);
  return JSON.stringify(entryNumbers) === JSON.stringify(issueNumbers);
}

function issueSixNamesProtectedPath(folder: string): boolean {
  if (entryFor(folder, 6)?.decision !== "refuse") return false;
  const reason = entryFor(folder, 6)?.reason ?? "";
  return PROTECTED.some((protectedPath) => reason.includes(protectedPath.replace(/\/$/, "")));
}

function readyFilesAreKnown(folder: string): boolean {
  const known = new Set(appFiles());
  const isKnownOrNewTest = (path: string) => known.has(path) || /^tests\/.+\.test\.ts$/.test(path);
  return readyEntries(folder).every((entry) => (entry.files ?? []).every(isKnownOrNewTest));
}

export default [
  {
    says: "factory/backlog.json is a JSON list",
    test: (folder) => backlog(folder) !== null,
    tryNext:
      "ask Claude Code to make factory/backlog.json one JSON list, " +
      'shaped like [ { "issue": 1, ... }, ... ]',
  },
  {
    says: "every issue in world/backlog has exactly one entry",
    test: everyIssueHasOneEntry,
    tryNext: "ask Claude Code for one entry for each issue 1 to 7, and no issue twice",
  },
  {
    says: "each decision is ready, split or refuse, with a reason of at least five words",
    test: (folder) =>
      (backlog(folder) ?? []).every(
        (entry) =>
          ["ready", "split", "refuse"].includes(entry.decision) && wordCount(entry.reason) >= 5,
      ),
    tryNext:
      "ask Claude Code to use only ready, split or refuse, " +
      "and to say why in the reason as a full sentence",
  },
  {
    says: "issue 6 is refused and the reason names the protected path",
    test: issueSixNamesProtectedPath,
    tryNext:
      "read issue 6 again: which folder would it change, and who reviews that folder? " +
      "Ask Claude Code to name it in the reason",
  },
  {
    says: "issue 7 is not ready as one piece",
    test: (folder) => Boolean(entryFor(folder, 7)) && entryFor(folder, 7)?.decision !== "ready",
    tryNext:
      "a major upgrade with unknown breakage is not one outcome; " +
      "ask Claude Code to split it, or refuse it until a person plans it",
  },
  {
    says: "every ready issue names one outcome and one to five files",
    test: (folder) => {
      const ready = readyEntries(folder);
      if (ready.length === 0) return false;
      return ready.every((entry) => wordCount(entry.outcome) >= 5 && namesOneToFiveFiles(entry));
    },
    tryNext:
      "ask Claude Code to give each ready issue an outcome (one sentence a person can check) " +
      "and files (the 1 to 5 paths it will change)",
  },
  {
    says: "every file a ready issue names is in the app, or is a new test under tests/",
    test: readyFilesAreKnown,
    tryNext:
      "ask Claude Code for paths as they appear inside world/app, such as src/fees/split.ts, " +
      "not world/app/src/fees/split.ts",
  },
  {
    says: "no ready issue touches a protected path",
    test: (folder) => readyEntries(folder).every((entry) => !(entry.files ?? []).some(isProtected)),
    tryNext:
      "an issue that changes src/auth/ cannot be ready for the factory; " +
      "ask Claude Code to refuse it and say who must review it",
  },
] satisfies Rule[];
