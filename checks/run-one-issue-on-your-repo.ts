// run-one-issue-on-your-repo: the capstone. The learner runs the factory once on their own repo and
// brings evidence. This check reads only the learner's own files, never the course world. It proves the
// shape of the record and that the evidence files exist. It cannot prove the pull request is real.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json, read, sections } from "./lib/files";

// biome-ignore-start lint/style/useNamingConvention: run.json uses snake_case keys.
type Run = {
  repo?: string;
  issue?: number;
  branch?: string;
  pull_request_url?: string;
  draft?: boolean;
  gate_passed?: boolean;
  tests_edited?: string[];
  files_changed?: string[];
  cost_usd?: number;
  cap_usd?: number;
};
// biome-ignore-end lint/style/useNamingConvention: run.json uses snake_case keys.

const PRACTICE_REPOS = /northside|library|example-org\/(library|northside)/i;
const PULL_REQUEST = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;
const NOTE_HEADINGS = [
  "what i ran it on",
  "the gate that fired or held",
  "what it cost",
  "what i change next",
];

const runRecord = (folder: string) => json<Run>(join(folder, "evidence", "run.json"));

function namesYourRepo(folder: string): boolean {
  const run = runRecord(folder);
  const repo = run?.repo ?? "";
  return /^[\w.-]+\/[\w.-]+$/.test(repo) && !PRACTICE_REPOS.test(repo) && Number(run?.issue) > 0;
}

function pullRequestIsDraftOnBranch(folder: string): boolean {
  const run = runRecord(folder);
  const branch = run?.branch ?? "";
  const onBranch = branch !== "" && !["main", "master"].includes(branch);
  return onBranch && run?.draft === true && PULL_REQUEST.test(run.pull_request_url ?? "");
}

function pullRequestMatchesRepo(folder: string): boolean {
  const run = runRecord(folder);
  return (run?.pull_request_url ?? "").startsWith(`https://github.com/${run?.repo}/pull/`);
}

function gateHeldAndNoTestEdited(folder: string): boolean {
  const run = runRecord(folder);
  const changed = run?.files_changed ?? [];
  return run?.gate_passed === true && run.tests_edited?.length === 0 && changed.length > 0;
}

function costIsUnderTheCap(folder: string): boolean {
  const run = runRecord(folder);
  const cost = Number(run?.cost_usd);
  return cost > 0 && Number(run?.cap_usd) > 0 && cost <= Number(run?.cap_usd);
}

function gateOutputAndFenceExist(folder: string): boolean {
  const gate = read(join(folder, "evidence", "gate.txt")) ?? "";
  const settings = json<{ permissions?: { deny?: unknown[] } }>(
    join(folder, "evidence", "claude-settings.json"),
  );
  return gate.trim().length > 0 && (settings?.permissions?.deny?.length ?? 0) > 0;
}

function notesAreWritten(folder: string): boolean {
  const found = sections(read(join(folder, "notes", "own-repo.md")) ?? "");
  return NOTE_HEADINGS.every((heading) => (found.get(heading) ?? "").split(/\s+/).length >= 8);
}

export default [
  {
    says: "evidence/run.json names your own repo, not the library, and an issue number",
    test: namesYourRepo,
    tryNext: "put your own owner/name in repo and your issue number in issue",
  },
  {
    says: "the pull request is a draft with a real GitHub link, on a branch that is not main",
    test: pullRequestIsDraftOnBranch,
    tryNext: "paste the real pull request link, set draft to true, and name the factory branch",
  },
  {
    says: "the pull request link belongs to the repo you named",
    test: pullRequestMatchesRepo,
    tryNext: "the link must start with https://github.com/ and your owner/name",
  },
  {
    says: "the gate passed, no test file was edited, and at least one file changed",
    test: gateHeldAndNoTestEdited,
    tryNext:
      "list the changed files, leave tests_edited empty, and set gate_passed after a real run",
  },
  {
    says: "the cost is above zero and under the cap",
    test: costIsUnderTheCap,
    tryNext: "write the real cost and the cap you set, in dollars",
  },
  {
    says: "evidence has the gate output and a settings file with deny rules",
    test: gateOutputAndFenceExist,
    tryNext:
      "save the gate output to evidence/gate.txt and copy .claude/settings.json with deny rules",
  },
  {
    says: "notes/own-repo.md answers its four headings",
    test: notesAreWritten,
    tryNext: "write a few sentences under each of the four headings",
  },
] satisfies Rule[];
