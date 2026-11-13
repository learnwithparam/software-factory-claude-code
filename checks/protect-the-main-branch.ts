// protect-the-main-branch: the last wall lives on GitHub, where no file on the agent's machine
// can change it. A workflow runs the gate as a check named gate, CODEOWNERS gives the factory's
// own files to a person, and a ruleset makes main require a pull request and the gate check
// from the GitHub Actions app, with nobody allowed to bypass it.
// The files sit in the step folder under github/; in a real repo that folder is .github/.
// They are checked offline: no GitHub account is needed to pass.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json, read, yaml } from "./lib/files";

// The app id GitHub gives its own GitHub Actions app. A required check pinned to it can only
// be set by a workflow run, not by a token that posts a status by hand.
const GITHUB_ACTIONS_APP_ID = 15368;
const OWNED_PATHS = [".claude/", ".github/", "factory/"];

// biome-ignore-start lint/style/useNamingConvention: GitHub's ruleset JSON uses snake_case.
type RulesetRule = {
  type?: string;
  parameters?: {
    require_code_owner_review?: boolean;
    required_approving_review_count?: number;
    required_status_checks?: { context?: string; integration_id?: number }[];
  };
};
type Ruleset = {
  target?: string;
  enforcement?: string;
  bypass_actors?: unknown[];
  conditions?: { ref_name?: { include?: string[] } };
  rules?: RulesetRule[];
};
// biome-ignore-end lint/style/useNamingConvention: the ruleset types end here.
type Step = { run?: string };
type Job = { name?: string; steps?: Step[]; permissions?: unknown };
type Workflow = { on?: unknown; jobs?: Record<string, Job>; permissions?: unknown };

function workflow(folder: string): Workflow | null {
  return yaml<Workflow>(join(folder, "github", "workflows", "gate.yml"));
}

function ruleset(folder: string): Ruleset | null {
  return json<Ruleset>(join(folder, "factory", "ruleset.json"));
}

function rulesOfType(folder: string, type: string): RulesetRule[] {
  return (ruleset(folder)?.rules ?? []).filter((rule) => rule.type === type);
}

// YAML reads a bare "on:" key as the word on; both spellings name the triggers.
function triggers(file: Workflow): string {
  const raw = file.on ?? (file as Record<string, unknown>).true;
  return JSON.stringify(raw ?? "");
}

function gateJob(folder: string): Job | undefined {
  const jobs = workflow(folder)?.jobs ?? {};
  return Object.entries(jobs).find(([id, job]) => id === "gate" || job.name === "gate")?.[1];
}

function isReadOnly(permissions: unknown): boolean {
  if (permissions === undefined) return true;
  return !JSON.stringify(permissions).includes("write");
}

function ownersLines(folder: string): string[] {
  const text = read(join(folder, "github", "CODEOWNERS")) ?? "";
  const lines = text.split("\n").map((line) => line.trim());
  return lines.filter((line) => line && !line.startsWith("#"));
}

// True when a CODEOWNERS line gives this path to at least one @owner.
function hasOwner(folder: string, path: string): boolean {
  return ownersLines(folder).some((line) => {
    const [pattern, ...owners] = line.split(/\s+/);
    const coversPath = pattern.replace(/^\//, "").replace(/\*+$/, "") === path;
    return coversPath && owners.some((owner) => owner.startsWith("@"));
  });
}

function gateCheckIsPinned(folder: string): boolean {
  const checks = rulesOfType(folder, "required_status_checks").flatMap(
    (rule) => rule.parameters?.required_status_checks ?? [],
  );
  return checks.some(
    (check) => check.context === "gate" && check.integration_id === GITHUB_ACTIONS_APP_ID,
  );
}

export default [
  {
    says: "github/workflows/gate.yml parses and runs on pull_request",
    test: (folder) => {
      const file = workflow(folder);
      return file !== null && triggers(file).includes("pull_request");
    },
    tryNext: "ask Claude Code for a workflow at github/workflows/gate.yml with on: pull_request",
  },
  {
    says: "a job named gate runs bun run gate",
    test: (folder) =>
      (gateJob(folder)?.steps ?? []).some((step) => step.run?.includes("bun run gate")),
    tryNext:
      "ask Claude Code to call the job gate, so the check on the pull request is named gate, " +
      "and to end it with a step that runs bun run gate",
  },
  {
    says: "the workflow's token can only read",
    test: (folder) => {
      const file = workflow(folder);
      const jobs = Object.values(file?.jobs ?? {});
      const declared = file?.permissions !== undefined || jobs.some((job) => job.permissions);
      return (
        declared &&
        isReadOnly(file?.permissions) &&
        jobs.every((job) => isReadOnly(job.permissions))
      );
    },
    tryNext: "ask Claude Code to add permissions: contents: read, and no write permission anywhere",
  },
  {
    says: "github/CODEOWNERS gives .claude/, .github/ and factory/ to a person or team",
    test: (folder) => OWNED_PATHS.every((path) => hasOwner(folder, path)),
    tryNext:
      "ask Claude Code for one CODEOWNERS line per folder, such as /.claude/ @your-name; " +
      "the factory must never approve changes to its own walls",
  },
  {
    says: "factory/ruleset.json is an active branch ruleset on the default branch",
    test: (folder) => {
      const file = ruleset(folder);
      const branches = file?.conditions?.ref_name?.include ?? [];
      const onMain = branches.some((name) => ["~DEFAULT_BRANCH", "refs/heads/main"].includes(name));
      return file?.target === "branch" && file.enforcement === "active" && onMain;
    },
    tryNext:
      'ask Claude Code for target "branch", enforcement "active" and ' +
      'conditions.ref_name.include ["~DEFAULT_BRANCH"]',
  },
  {
    says: "the ruleset requires a pull request with a code owner's review",
    test: (folder) =>
      rulesOfType(folder, "pull_request").some(
        (rule) =>
          rule.parameters?.require_code_owner_review === true &&
          (rule.parameters.required_approving_review_count ?? 0) >= 1,
      ),
    tryNext:
      "ask Claude Code for a pull_request rule with require_code_owner_review true " +
      "and at least one approving review",
  },
  {
    says: `the ruleset requires the gate check from the Actions app, id ${GITHUB_ACTIONS_APP_ID}`,
    test: gateCheckIsPinned,
    tryNext:
      "anyone with write access can post a status named gate; ask Claude Code to pin the check " +
      `with integration_id ${GITHUB_ACTIONS_APP_ID}`,
  },
  {
    says: "the ruleset blocks force pushes and lets nobody bypass it",
    test: (folder) => {
      const blocksForcePush = rulesOfType(folder, "non_fast_forward").length > 0;
      const bypass = ruleset(folder)?.bypass_actors ?? [];
      return ruleset(folder) !== null && blocksForcePush && bypass.length === 0;
    },
    tryNext:
      "ask Claude Code to add a non_fast_forward rule and an empty bypass_actors list; " +
      "a bypass for the factory's token is a door around every wall",
  },
] satisfies Rule[];
