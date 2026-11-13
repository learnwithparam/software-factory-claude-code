// trim-the-agents-file: a short AGENTS.md that says only what the repo cannot say for itself,
// and a CLAUDE.md that imports it instead of copying it.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { nonEmptyLines, read, sections } from "./lib/files";
import { appFiles } from "./lib/world";

const MOST_LINES = 80;
const MOST_CLAUDE_LINES = 5;

function agentsText(folder: string): string {
  return read(join(folder, "AGENTS.md")) ?? "";
}

function claudeText(folder: string): string {
  return read(join(folder, "CLAUDE.md")) ?? "";
}

function sectionText(folder: string, heading: string): string {
  return sections(agentsText(folder)).get(heading) ?? "";
}

// Every folder in the app, such as "src/", "src/fees/" and "tests/fees/".
function appFolders(): string[] {
  const folders = new Set<string>();
  for (const file of appFiles()) {
    const pieces = file.split("/").slice(0, -1);
    for (let depth = 1; depth <= pieces.length; depth++) {
      folders.add(`${pieces.slice(0, depth).join("/")}/`);
    }
  }
  return [...folders];
}

// A line with its bullet, table bar, quote mark, backticks and spaces taken off the front.
function bareLine(line: string): string {
  return line.replace(/^[\s\-*|>`]+/, "").toLowerCase();
}

// True when a line only tells Claude Code where a folder is, which it can see for itself.
// A tree entry such as "fees/" counts too.
function restatesAFolder(line: string, folders: string[]): boolean {
  const bare = bareLine(line).replace(/^world\/app\//, "");
  if (/^[a-z0-9_.-]+\/`?$/.test(bare)) return true;
  return folders.some((folder) => bare.startsWith(folder));
}

// The lines that restate the folder tree. Protected paths may name a folder: that is the point.
function folderLines(folder: string): string[] {
  const folders = appFolders();
  const found: string[] = [];
  let heading = "";
  for (const line of agentsText(folder).split("\n")) {
    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) heading = headingMatch[1].toLowerCase();
    else if (heading !== "protected paths" && restatesAFolder(line, folders)) found.push(line);
  }
  return found;
}

function importsAgents(folder: string): boolean {
  return claudeText(folder)
    .split("\n")
    .some((line) => line.trim() === "@AGENTS.md");
}

export default [
  {
    says: `AGENTS.md exists and is under ${MOST_LINES} lines`,
    test: (folder) => {
      const text = agentsText(folder);
      return text.length > 0 && text.trimEnd().split("\n").length < MOST_LINES;
    },
    tryNext:
      "ask Claude Code to cut every line that Claude Code could learn by reading the repo, " +
      "until AGENTS.md is under 80 lines",
  },
  {
    says: "AGENTS.md has the headings Commands, Protected paths and Done when",
    test: (folder) => {
      const headings = sections(agentsText(folder));
      return ["commands", "protected paths", "done when"].every((name) => headings.has(name));
    },
    tryNext:
      "ask Claude Code to keep exactly these three headings: Commands, Protected paths, Done when",
  },
  {
    says: "Commands names bun run gate as the one gate",
    test: (folder) => sectionText(folder, "commands").includes("bun run gate"),
    tryNext: "tell Claude Code to keep the line about bun run gate under Commands",
  },
  {
    says: "Protected paths names src/auth/",
    test: (folder) => sectionText(folder, "protected paths").includes("src/auth/"),
    tryNext: "tell Claude Code that src/auth/ is protected and must stay under Protected paths",
  },
  {
    says: "Done when says bun run gate passes",
    test: (folder) => sectionText(folder, "done when").includes("bun run gate"),
    tryNext:
      "ask Claude Code to write under Done when: bun run gate passes on the code as it is now",
  },
  {
    says: "no line in AGENTS.md only says where a folder is",
    test: (folder) => agentsText(folder).length > 0 && folderLines(folder).length === 0,
    tryNext:
      "ask Claude Code to delete the folder tree and every line like `src/fees/` holds fees: " +
      "Claude Code reads the folders itself",
  },
  {
    says: "CLAUDE.md imports AGENTS.md with a line that says @AGENTS.md",
    test: importsAgents,
    tryNext: "ask Claude Code to replace CLAUDE.md with one line: @AGENTS.md",
  },
  {
    says: `CLAUDE.md copies nothing: ${MOST_CLAUDE_LINES} lines or fewer`,
    test: (folder) => {
      const lines = nonEmptyLines(claudeText(folder));
      return lines.length > 0 && lines.length <= MOST_CLAUDE_LINES;
    },
    tryNext:
      "ask Claude Code to remove everything from CLAUDE.md except the @AGENTS.md import, " +
      "so the rules live in one place",
  },
] satisfies Rule[];
