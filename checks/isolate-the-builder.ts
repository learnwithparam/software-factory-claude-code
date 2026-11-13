// isolate-the-builder: the builder works in its own git worktree, the worktree folder is ignored,
// and .worktreeinclude never copies a secret into it. A dry run proves all three with real git.
import { cpSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agent, agentTools, toolNames } from "../parts/03-split-the-roles/agents";
import type { Rule } from "../scripts/verify";
import { nonEmptyLines, read } from "./lib/files";
import { runCommand } from "./lib/run";

const WORKTREE = ".claude/worktrees/builder";
const SECRETS = [".env", ".env.local"];

type DryRun = { secretsCopied: string[]; mainStayedClean: boolean; removedCleanly: boolean };

const git = (repo: string, ...args: string[]) =>
  runCommand([
    "git",
    "-c",
    "user.name=Northside factory",
    "-c",
    "user.email=factory@northside.invalid",
    "-c",
    "commit.gpgsign=false",
    "-C",
    repo,
    ...args,
  ]);

// A copy of the learner's folder as its own repo, with two fake secrets that git ignores,
// the way the course repo ignores every .env file except .env.example.
function practiceRepo(folder: string): string {
  const repo = join(mkdtempSync(join(tmpdir(), "isolate-")), "repo");
  cpSync(folder, repo, { recursive: true });
  for (const secret of SECRETS)
    writeFileSync(join(repo, secret), "DESK_SMS_TOKEN=not-a-real-token\n");
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, ".git", "info", "exclude"), ".env\n.env.*\n!.env.example\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "before the builder");
  return repo;
}

// What Claude Code copies into a new worktree: files that match .worktreeinclude
// and that git ignores. Tracked files are never copied.
function filesToCopy(repo: string): string[] {
  if (!existsSync(join(repo, ".worktreeinclude"))) return [];
  const listIgnored = ["ls-files", "--others", "--ignored"];
  const included = git(repo, ...listIgnored, "--exclude-from=.worktreeinclude").stdout;
  const ignored = git(repo, ...listIgnored, "--exclude-standard").stdout;
  const ignoredFiles = nonEmptyLines(ignored);
  return nonEmptyLines(included).filter((file) => ignoredFiles.includes(file));
}

function dryRunIn(repo: string): DryRun {
  const added = git(repo, "worktree", "add", "-q", WORKTREE, "-b", "worktree-builder");
  if (added.code !== 0) return { secretsCopied: [], mainStayedClean: false, removedCleanly: false };
  for (const file of filesToCopy(repo)) cpSync(join(repo, file), join(repo, WORKTREE, file));
  const secretsCopied = SECRETS.filter((secret) => existsSync(join(repo, WORKTREE, secret)));
  const mainStayedClean = git(repo, "status", "--porcelain").stdout.trim() === "";
  git(repo, "worktree", "remove", "--force", WORKTREE);
  const trees = nonEmptyLines(git(repo, "worktree", "list").stdout);
  return { secretsCopied, mainStayedClean, removedCleanly: trees.length === 1 };
}

const dryRuns = new Map<string, DryRun>();

// The dry run is slow, so each folder runs it once and every rule reads the same answer.
function dryRun(folder: string): DryRun {
  const known = dryRuns.get(folder);
  if (known) return known;
  const result = dryRunIn(practiceRepo(folder));
  dryRuns.set(folder, result);
  return result;
}

function includePatterns(folder: string): string[] {
  const lines = nonEmptyLines(read(join(folder, ".worktreeinclude")) ?? "");
  return lines.filter((line) => !line.startsWith("#"));
}

export default [
  {
    says: "builder.md sets isolation: worktree",
    test: (folder) => agent(folder, "builder")?.data.isolation === "worktree",
    tryNext: "ask Claude Code to add isolation: worktree to the frontmatter of builder.md",
  },
  {
    says: "builder.md still has Edit and Bash",
    test: (folder) => {
      const tools = toolNames(agentTools(folder, "builder"));
      return tools.includes("Edit") && tools.includes("Bash");
    },
    tryNext:
      "tell Claude Code to keep the builder's tools as they were: it still has to edit and test",
  },
  {
    says: ".gitignore ignores .claude/worktrees/",
    test: (folder) => {
      const ignored = nonEmptyLines(read(join(folder, ".gitignore")) ?? "");
      return ignored.some((line) => /^\/?\.claude\/worktrees\/?(\*\*)?$/.test(line));
    },
    tryNext: "ask Claude Code to add the line .claude/worktrees/ to .gitignore in this folder",
  },
  {
    says: ".worktreeinclude names .env.example",
    test: (folder) => includePatterns(folder).includes(".env.example"),
    tryNext: "ask Claude Code to write .worktreeinclude with the one line .env.example",
  },
  {
    says: "a dry run copies no .env or .env.local into the builder's worktree",
    test: (folder) => {
      const hasInclude = existsSync(join(folder, ".worktreeinclude"));
      return hasInclude && dryRun(folder).secretsCopied.length === 0;
    },
    tryNext:
      "remove every line in .worktreeinclude that matches .env, such as .env or .env*; " +
      "an unattended builder must not get your secrets",
  },
  {
    says: "while the worktree exists, the main checkout shows no untracked files",
    test: (folder) => dryRun(folder).mainStayedClean,
    tryNext: "ask Claude Code to add .claude/worktrees/ to .gitignore, then run the check again",
  },
  {
    says: "the dry run removes the worktree and leaves one tree",
    test: (folder) => dryRun(folder).removedCleanly,
    tryNext: "run git worktree list in a terminal; remove any worktree left over, then check again",
  },
] satisfies Rule[];
