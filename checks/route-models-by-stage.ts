// route-models-by-stage: each stage asks for a role, and the role picks the model.
// Triage only reads, so it runs on the fast role. A plan stage runs only for high-risk issues.
// Checked with dry runs: they make no claude call, and commands.txt shows the model of each call.
import { join } from "node:path";
import { claudeLines, dryRun } from "../parts/06-price-and-ship/factory-checks";
import type { Rule } from "../scripts/verify";
import { frontmatter, listFiles } from "./lib/files";

const ROLES = ["fast", "smart", "judge"];
const ALIAS: Record<string, string> = { fast: "haiku", smart: "sonnet", judge: "sonnet" };
const EXPECTED_ROLES: Record<string, string> = {
  triage: "fast",
  spec: "smart",
  plan: "smart",
  build: "smart",
  review: "judge",
};
const FULL_MODEL_ID = /--model\s+'?claude-/;

function stageRole(folder: string, stage: string): string | null {
  const parsed = frontmatter(join(folder, "factory", "stages", `${stage}.md`));
  const role = parsed?.data.role;
  return typeof role === "string" ? role : null;
}

function stageNames(folder: string): string[] {
  const files = listFiles(join(folder, "factory", "stages"));
  const prompts = files.filter((file) => file.endsWith(".md"));
  return prompts.map((file) => file.replace(/\.md$/, ""));
}

function everyStageNamesRole(folder: string): boolean {
  const names = stageNames(folder);
  return names.length > 0 && names.every((stage) => ROLES.includes(stageRole(folder, stage) ?? ""));
}

function rolesFitTheWork(folder: string): boolean {
  const stages = Object.keys(EXPECTED_ROLES);
  return stages.every((stage) => stageRole(folder, stage) === EXPECTED_ROLES[stage]);
}

function stageOfLine(line: string): string {
  return line.match(/FACTORY_STAGE=(\w+)/)?.[1] ?? "";
}

function modelOfLine(line: string): string {
  return line.match(/--model\s+'?([\w.-]+)/)?.[1] ?? "";
}

// Every call's --model is the alias of the role its stage file names.
function modelsFollowRoles(folder: string, issue: number): boolean {
  const lines = claudeLines(dryRun(folder, issue));
  if (lines.length === 0) return false;
  return lines.every((line) => {
    const role = stageRole(folder, stageOfLine(line)) ?? "";
    return modelOfLine(line) === ALIAS[role] && !FULL_MODEL_ID.test(line);
  });
}

function highRiskIssuePlans(folder: string): boolean {
  const run = dryRun(folder, 2);
  const planLines = claudeLines(run).filter((line) => stageOfLine(line) === "plan");
  return run.result?.roles_by_stage.plan === "smart" && planLines.length === 1;
}

function docsIssueNeverPlans(folder: string): boolean {
  const run = dryRun(folder, 1);
  const planLines = claudeLines(run).filter((line) => stageOfLine(line) === "plan");
  const planRole = run.result?.roles_by_stage.plan;
  const noPlan = planRole === undefined || planRole === "none";
  return run.result?.state === "draft_pr" && noPlan && planLines.length === 0;
}

function triageIsFast(folder: string): boolean {
  const run = dryRun(folder, 1);
  const triageLine = claudeLines(run).find((line) => stageOfLine(line) === "triage") ?? "";
  return run.result?.roles_by_stage.triage === "fast" && modelOfLine(triageLine) === "haiku";
}

export default [
  {
    says: "every file in factory/stages names its role (fast, smart or judge) in its frontmatter",
    test: everyStageNamesRole,
    tryNext:
      "ask Claude Code to start each stage file with ---, a line role: fast (or smart, judge), ---",
  },
  {
    says: "triage is fast, spec, plan and build are smart, review is judge",
    test: rolesFitTheWork,
    tryNext:
      "triage only reads, so it is fast; ask Claude Code to add factory/stages/plan.md on smart " +
      "and to set review to judge",
  },
  {
    says: "the dry run of issue 1 runs triage on the fast role, with --model haiku",
    test: triageIsFast,
    tryNext:
      "run bun run factory 1 --dry-run --json and read the triage line in runs/1/commands.txt; " +
      "ask Claude Code to read the role from the stage file",
  },
  {
    says: "issue 2 (money, high risk) runs a plan stage on the smart role",
    test: highRiskIssuePlans,
    tryNext:
      "in a dry run, an issue labelled money, privacy or safety is high risk; " +
      "ask Claude Code to run the plan stage for it",
  },
  {
    says: "issue 1 (docs) never runs the plan stage",
    test: docsIssueNeverPlans,
    tryNext: "ask Claude Code to run the plan stage only for high-risk issues",
  },
  {
    says: "every claude -p call uses the alias of its stage's role, never a full model id",
    test: (folder) => modelsFollowRoles(folder, 1) && modelsFollowRoles(folder, 2),
    tryNext:
      "ask Claude Code to map roles to aliases in one place (fast haiku, smart sonnet, " +
      "judge sonnet) and to pass that alias to --model",
  },
] satisfies Rule[];
