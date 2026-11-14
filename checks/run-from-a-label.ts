// run-from-a-label: a GitHub Actions workflow that starts the factory only when a person adds the
// label factory:ready to an issue. Checked offline from workflow/factory.yml: no GitHub needed.
// In a learner's own repo the same file lives in .github/workflows/.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { read, yaml } from "./lib/files";
import { ranCommand, readSession } from "./lib/session";

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = {
  if?: string;
  permissions?: unknown;
  concurrency?: { group?: string } | string;
  steps?: Step[];
  "timeout-minutes"?: number;
};
type Workflow = { on?: unknown; permissions?: unknown; jobs?: Record<string, Job> };

const KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]{8,}/;
const SECRET_REFERENCE = /^\$\{\{\s*secrets\.[A-Z_]+\s*\}\}$/;
const LABEL_CONDITION = /github\.event\.label\.name\s*==\s*'factory:ready'/;
const AUTH_INPUTS = ["claude_code_oauth_token", "anthropic_api_key"];

function workflowPath(folder: string): string {
  return join(folder, "workflow", "factory.yml");
}

function workflow(folder: string): Workflow | null {
  const parsed = yaml<Workflow>(workflowPath(folder));
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
}

function jobs(folder: string): Job[] {
  return Object.values(workflow(folder)?.jobs ?? {});
}

function allSteps(folder: string): Step[] {
  return jobs(folder).flatMap((job) => job.steps ?? []);
}

function actionSteps(folder: string): Step[] {
  const steps = allSteps(folder);
  return steps.filter((step) => step.uses === "anthropics/claude-code-action@v1");
}

function triggersOnlyOnLabel(folder: string): boolean {
  const triggers = workflow(folder)?.on as Record<string, { types?: string[] }> | undefined;
  if (!triggers || typeof triggers !== "object") return false;
  const events = Object.keys(triggers);
  const types = triggers.issues?.types ?? [];
  return events.length === 1 && events[0] === "issues" && types.join() === "labeled";
}

function everyJobWaitsForTheLabel(folder: string): boolean {
  const allJobs = jobs(folder);
  return allJobs.length > 0 && allJobs.every((job) => LABEL_CONDITION.test(job.if ?? ""));
}

function signsInWithSecret(folder: string): boolean {
  const steps = actionSteps(folder);
  if (steps.length === 0) return false;
  return steps.every((step) => {
    const authValues = AUTH_INPUTS.map((input) => step.with?.[input]).filter(Boolean);
    return (
      authValues.length > 0 && authValues.every((value) => SECRET_REFERENCE.test(String(value)))
    );
  });
}

function capsEveryAction(folder: string): boolean {
  const steps = actionSteps(folder);
  if (steps.length === 0) return false;
  return steps.every((step) => {
    const claudeArguments = String(step.with?.claude_args ?? "");
    return claudeArguments.includes("--max-turns") && claudeArguments.includes("--max-budget-usd");
  });
}

function concurrencyPerIssue(folder: string): boolean {
  const allJobs = jobs(folder);
  return allJobs.every((job) => {
    const concurrency = job.concurrency;
    const group = typeof concurrency === "string" ? concurrency : (concurrency?.group ?? "");
    return group.includes("github.event.issue.number");
  });
}

function everyJobHasTimeout(folder: string): boolean {
  const allJobs = jobs(folder);
  return allJobs.length > 0 && allJobs.every((job) => Number(job["timeout-minutes"]) > 0);
}

function permissionsAreNamed(folder: string): boolean {
  const named = (permissions: unknown) => typeof permissions === "object" && permissions !== null;
  const allJobs = jobs(folder);
  return allJobs.length > 0 && allJobs.every((job) => named(job.permissions));
}

function opensDraftAndNeverMerges(folder: string): boolean {
  const text = read(workflowPath(folder)) ?? "";
  const neverMerges = !/gh pr merge(?!\s*\*)|--auto\b|gh pr ready(?!\s*\*)/.test(text);
  return (
    /gh pr create[^\n]*--draft|--draft[^\n]*\n?[^\n]*gh pr create|draft:\s*true/.test(text) &&
    neverMerges
  );
}

// An issue body is typed by a stranger. If it is pasted into a prompt or a shell line, the stranger
// writes your instructions. Numbers and the label name are safe; text fields are not.
const HOSTILE_NAMES =
  "issue\\.(title|body)|comment\\.body|pull_request\\.(title|body)|head_commit\\.message";
const HOSTILE_FIELD = new RegExp(`\\$\\{\\{[^}]*github\\.event\\.(${HOSTILE_NAMES})[^}]*\\}\\}`);

function hostileTextStaysOut(folder: string): boolean {
  const text = read(workflowPath(folder)) ?? "";
  return text.length > 0 && !HOSTILE_FIELD.test(text);
}

export default [
  {
    says: "workflow/factory.yml is a YAML workflow",
    test: (folder) => workflow(folder)?.jobs !== undefined,
    tryNext: "ask Claude Code to write workflow/factory.yml as a GitHub Actions workflow with jobs",
  },
  {
    says: "it triggers only when a label is added to an issue",
    test: triggersOnlyOnLabel,
    tryNext: "ask Claude Code for one trigger, issues with types [labeled], and nothing else",
  },
  {
    says: "every job runs only for the label factory:ready",
    test: everyJobWaitsForTheLabel,
    tryNext:
      "a labeled trigger fires for every label; ask Claude Code for " +
      "if: github.event.label.name == 'factory:ready' on the job",
  },
  {
    says: "it uses claude-code-action@v1 and signs in with a secret, never a key in the file",
    test: (folder) =>
      signsInWithSecret(folder) && !KEY_PATTERN.test(read(workflowPath(folder)) ?? ""),
    tryNext:
      "ask Claude Code to pass the secret CLAUDE_CODE_OAUTH_TOKEN to claude_code_oauth_token, " +
      "and to delete any key written into the file",
  },
  {
    says: "claude_args caps the run with --max-turns and --max-budget-usd",
    test: capsEveryAction,
    tryNext: "ask Claude Code to add --max-turns and --max-budget-usd to claude_args",
  },
  {
    says: "each issue gets its own concurrency group, and each job has a timeout",
    test: (folder) => concurrencyPerIssue(folder) && everyJobHasTimeout(folder),
    tryNext:
      "ask Claude Code for a concurrency group named after github.event.issue.number " +
      "and timeout-minutes on the job",
  },
  {
    says: "every job names the permissions it needs",
    test: permissionsAreNamed,
    tryNext:
      "ask Claude Code for a permissions block on the job, such as contents: write, " +
      "pull-requests: write and issues: write",
  },
  {
    says: "it opens the pull request as a draft and never merges",
    test: opensDraftAndNeverMerges,
    tryNext:
      "ask Claude Code to open the PR with gh pr create --draft, " +
      "and to remove any merge, auto-merge or ready step",
  },
  {
    says: "the issue title and body never go into the prompt or a shell line",
    test: hostileTextStaysOut,
    tryNext:
      "a stranger can write the issue body, so use only github.event.issue.number; " +
      "let the factory read the issue itself, and remove any title or body from the file",
  },
  {
    says: "your saved session shows you ran /schedule",
    test: (folder) => ranCommand(readSession(folder), "schedule"),
    tryNext: "type /schedule and set a routine that runs the factory, then save the session",
  },
] satisfies Rule[];
