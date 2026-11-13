// cap-the-spend: a run never starts a stage it cannot afford, and no token sits in a tracked file.
// Before each stage, the run adds that stage's --max-budget-usd to what it spent so far.
// If the sum is over FACTORY_CAP_USD, the stage does not start and the run ends stopped_budget.
// Checked with dry runs and a scan of the step folder: no model and no key.
import { join } from "node:path";
import { claudeLines, dryRun } from "../parts/06-price-and-ship/factory-checks";
import type { Rule } from "../scripts/verify";
import { listFiles, read } from "./lib/files";

const KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]{8,}/;
const SKIPPED = /^(\.env$|runs\/|node_modules\/)/;

function budgetOfLine(line: string): number {
  return Number(line.match(/--max-budget-usd\s+'?([\d.]+)/)?.[1] ?? Number.NaN);
}

function tinyCapStopsBeforeTriage(folder: string): boolean {
  // biome-ignore lint/style/useNamingConvention: the factory contract names this variable.
  const run = dryRun(folder, 1, { FACTORY_CAP_USD: "0.05" });
  const stopped = run.result?.state === "stopped_budget" && run.result.pr_url === null;
  return stopped && claudeLines(run).length === 0;
}

function noStageStartsOverTheCap(folder: string): boolean {
  // biome-ignore lint/style/useNamingConvention: the factory contract names this variable.
  const run = dryRun(folder, 2, { FACTORY_CAP_USD: "2.5" });
  const lines = claudeLines(run);
  const affordable = lines.every((line) => budgetOfLine(line) <= 2.5);
  return run.result?.state === "stopped_budget" && lines.length > 0 && affordable;
}

function defaultCapLetsOneRunFinish(folder: string): boolean {
  return dryRun(folder, 1).result?.state === "draft_pr";
}

function noTokenInAnyFile(folder: string): boolean {
  const files = listFiles(folder).filter((file) => !SKIPPED.test(file));
  return files.every((file) => !KEY_PATTERN.test(read(join(folder, file)) ?? ""));
}

function envFileIsIgnored(folder: string): boolean {
  const lines = (read(join(folder, ".gitignore")) ?? "").split("\n");
  return lines.some((line) => line.trim() === ".env" || line.trim() === ".env*");
}

export default [
  {
    says: "with FACTORY_CAP_USD=0.05, the dry run of issue 1 ends stopped_budget before triage starts",
    test: tinyCapStopsBeforeTriage,
    tryNext:
      "a dry run spends nothing, so a check of spent money never fires; ask Claude Code to add " +
      "each stage's --max-budget-usd to the spend before the stage starts",
  },
  {
    says: "with FACTORY_CAP_USD=2.5, issue 2 stops, and no stage it started could spend over 2.5",
    test: noStageStartsOverTheCap,
    tryNext:
      "run FACTORY_CAP_USD=2.5 bun run factory 2 --dry-run --json and read runs/2/commands.txt; " +
      "the build line asks for $3, so it must not start",
  },
  {
    says: "with the default cap, the dry run of issue 1 still ends in draft_pr",
    test: defaultCapLetsOneRunFinish,
    tryNext: "ask Claude Code for a default cap big enough for one whole run, such as 10",
  },
  {
    says: "no file in the folder holds a token, apart from the git-ignored .env",
    test: noTokenInAnyFile,
    tryNext:
      "search the folder for sk-ant- and ask Claude Code to move the token to .env, " +
      "or to the build server's secret store",
  },
  {
    says: ".gitignore keeps .env out of git",
    test: envFileIsIgnored,
    tryNext: "ask Claude Code to add a line .env to .gitignore in this folder",
  },
] satisfies Rule[];
