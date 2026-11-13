// package-the-triage-skill: a read-only skill that answers in a fixed contract,
// and three real runs of `/triage 6` that refuse the protected path.
import { join } from "node:path";
import {
  enoughRuns,
  finalReply,
  initEvent,
  isRealRun,
  type Transcript,
  toolsCalled,
  transcriptsIn,
} from "../parts/02-teach-the-repo/transcripts";
import type { Rule } from "../scripts/verify";
import { frontmatter } from "./lib/files";

const RUNS_NEEDED = 3;
const PASSING_RUNS_NEEDED = 2;
const WRITING_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const CONTRACT_LINES = ["TYPE:", "RISK:", "FILES:", "DECISION:"];

function skill(folder: string) {
  return frontmatter(join(folder, ".claude", "skills", "triage", "SKILL.md"));
}

// A tool list may be a YAML list or one string split by commas or spaces.
// A space inside brackets, as in Bash(git diff *), belongs to the tool.
function toolList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tool) => String(tool).trim());
  if (typeof value !== "string") return [];
  return value.match(/[A-Za-z]+(\([^)]*\))?/g) ?? [];
}

function runs(folder: string): Transcript[] {
  return transcriptsIn(join(folder, "runs", "triage-6"));
}

function loadedTheSkill(transcript: Transcript): boolean {
  return isRealRun(transcript) && (initEvent(transcript)?.skills ?? []).includes("triage");
}

// The last DECISION line of the reply, in lower case.
function decision(transcript: Transcript): string {
  const decisionLines = finalReply(transcript).match(/^DECISION:.*$/gim) ?? [];
  return (decisionLines.at(-1) ?? "").toLowerCase();
}

export default [
  {
    says: ".claude/skills/triage/SKILL.md has frontmatter with name triage and a description",
    test: (folder) => {
      const data = skill(folder)?.data;
      return data?.name === "triage" && String(data?.description ?? "").trim().length > 0;
    },
    tryNext:
      "ask Claude Code to start SKILL.md with a --- block that holds name: triage " +
      "and a description of when to use it",
  },
  {
    says: "allowed-tools pre-approves only reading tools: no Edit, no Write, no bare Bash",
    test: (folder) => {
      const allowed = toolList(skill(folder)?.data["allowed-tools"]);
      const writes = allowed.some((tool) => WRITING_TOOLS.includes(tool) || tool === "Bash");
      return allowed.length > 0 && !writes;
    },
    tryNext: "ask Claude Code to set allowed-tools to Read, Grep and Glob only",
  },
  {
    says: "disallowed-tools takes away Edit and Write while the skill runs",
    test: (folder) => {
      const disallowed = toolList(skill(folder)?.data["disallowed-tools"]);
      return ["Edit", "Write"].every((tool) => disallowed.includes(tool));
    },
    tryNext:
      "allowed-tools only skips the permission question; it forbids nothing. " +
      "Ask Claude Code to add disallowed-tools: Edit, Write",
  },
  {
    says: "the skill refuses any issue that needs a change in src/auth/",
    test: (folder) => {
      const body = skill(folder)?.body ?? "";
      return body.includes("src/auth/") && /refuse/i.test(body);
    },
    tryNext: "ask Claude Code to write in the skill: if a file is under src/auth/, refuse",
  },
  {
    says: "the skill ends with the reply contract: TYPE, RISK, FILES and DECISION proceed or refuse",
    test: (folder) => {
      const body = skill(folder)?.body ?? "";
      const lastPart = body.slice(Math.floor(body.length / 2));
      const hasEveryLine = CONTRACT_LINES.every((line) => lastPart.includes(line));
      return hasEveryLine && /proceed/i.test(lastPart) && /refuse/i.test(lastPart);
    },
    tryNext:
      "ask Claude Code to end the skill with four fixed lines: TYPE:, RISK:, FILES:, " +
      "and DECISION: proceed or refuse",
  },
  {
    says: `runs/triage-6/ holds ${RUNS_NEEDED} real claude -p runs that loaded the triage skill`,
    test: (folder) => {
      const transcripts = runs(folder);
      return transcripts.length >= RUNS_NEEDED && transcripts.every(loadedTheSkill);
    },
    tryNext:
      "run the three claude -p commands in this step's README, from this folder, " +
      "so each run saves its stream-json to runs/triage-6/",
  },
  {
    says: "no run changed a file: no Edit or Write call in any transcript",
    test: (folder) => {
      const transcripts = runs(folder);
      const changedAFile = (transcript: Transcript) =>
        toolsCalled(transcript).some((tool) => WRITING_TOOLS.includes(tool));
      return transcripts.length > 0 && !transcripts.some(changedAFile);
    },
    tryNext: "ask Claude Code to add disallowed-tools: Edit, Write to the skill, then run it again",
  },
  {
    says: `at least ${PASSING_RUNS_NEEDED} of the runs end with DECISION: refuse`,
    test: (folder) =>
      enoughRuns(runs(folder), PASSING_RUNS_NEEDED, (transcript) =>
        decision(transcript).startsWith("decision: refuse"),
      ),
    tryNext:
      "read the reply of a run that did not refuse, then tell Claude Code what the skill missed " +
      "about src/auth/roles.ts",
  },
] satisfies Rule[];
