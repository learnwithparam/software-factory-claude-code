// split-planner-and-builder: a planner that can only read and a builder that can change code,
// and three real runs of the planner on issue 3 whose plans name the right file.
import { join } from "node:path";
import {
  agent,
  agentTools,
  MODEL_ALIASES,
  toolNames,
  WRITING_TOOLS,
} from "../parts/03-split-the-roles/agents";
import {
  enoughRuns,
  finalReply,
  initEvent,
  isRealRun,
  type Transcript,
  toolsCalled,
  transcriptsIn,
} from "../parts/03-split-the-roles/transcripts";
import type { Rule } from "../scripts/verify";
import { sections } from "./lib/files";
import { appFiles } from "./lib/world";

const RUNS_NEEDED = 3;
const PASSING_RUNS_NEEDED = 2;
const THE_FILE = "src/loans/reserve.ts";

function runs(folder: string): Transcript[] {
  return transcriptsIn(join(folder, "runs", "planner-3"));
}

// The session ran as the planner when its tools were only the planner's reading tools.
function ranAsPlanner(transcript: Transcript): boolean {
  const tools = initEvent(transcript)?.tools ?? [];
  const canChange = tools.some((tool) => WRITING_TOOLS.includes(tool) || tool === "Bash");
  return isRealRun(transcript) && tools.length > 0 && !canChange;
}

// The paths under "## Files", one per line, with bullets and backticks taken off.
function plannedFiles(transcript: Transcript): { path: string; isNew: boolean }[] {
  const filesSection = sections(finalReply(transcript)).get("files") ?? "";
  const rawLines = filesSection.split("\n");
  const lines = rawLines.map((line) => line.replace(/[-*`]/g, "").trim());
  return lines.filter(Boolean).map((line) => {
    const path = line.split(/\s+/)[0];
    return { path, isNew: /\(new\)/i.test(line) };
  });
}

function planNamesTheFile(transcript: Transcript): boolean {
  const hasSteps = (sections(finalReply(transcript)).get("steps") ?? "").length > 0;
  const paths = plannedFiles(transcript).map((file) => file.path);
  return hasSteps && paths.includes(THE_FILE);
}

function everyFileIsReal(transcript: Transcript): boolean {
  const existing = appFiles();
  const files = plannedFiles(transcript);
  return files.length > 0 && files.every((file) => file.isNew || existing.includes(file.path));
}

export default [
  {
    says: "planner.md lists its tools, and none of them can change a file or run a command",
    test: (folder) => {
      const tools = toolNames(agentTools(folder, "planner"));
      const changes = tools.some((tool) => WRITING_TOOLS.includes(tool) || tool === "Bash");
      return tools.length > 0 && !changes;
    },
    tryNext:
      "ask Claude Code to set tools: Read, Grep, Glob in planner.md; " +
      "with no tools line, a subagent gets every tool",
  },
  {
    says: "planner.md sets a model",
    test: (folder) => MODEL_ALIASES.includes(String(agent(folder, "planner")?.data.model)),
    tryNext: "ask Claude Code to add model: sonnet to planner.md, so the plan's cost is a choice",
  },
  {
    says: "planner.md asks for a plan with a Files section and a Steps section",
    test: (folder) => {
      const prompt = agent(folder, "planner")?.body ?? "";
      return /##\s*Files/.test(prompt) && /##\s*Steps/.test(prompt);
    },
    tryNext: "ask Claude Code to end planner.md with the reply shape: ## Files, then ## Steps",
  },
  {
    says: "builder.md can edit files and run commands: Edit and Bash are in its tools",
    test: (folder) => {
      const tools = toolNames(agentTools(folder, "builder"));
      return tools.includes("Edit") && tools.includes("Bash");
    },
    tryNext: "ask Claude Code to give builder.md the tools Read, Grep, Glob, Edit, Write and Bash",
  },
  {
    says: `runs/planner-3/ holds ${RUNS_NEEDED} real claude -p runs made as the planner`,
    test: (folder) => {
      const transcripts = runs(folder);
      return transcripts.length >= RUNS_NEEDED && transcripts.every(ranAsPlanner);
    },
    tryNext:
      "run the claude -p --agent planner command in this step's README from this folder; " +
      "if the run had Edit or Bash, fix the planner's tools first",
  },
  {
    says: "no planner run called a tool that changes a file",
    test: (folder) => {
      const transcripts = runs(folder);
      const changedFile = (transcript: Transcript) =>
        toolsCalled(transcript).some((tool) => WRITING_TOOLS.includes(tool));
      return transcripts.length > 0 && !transcripts.some(changedFile);
    },
    tryNext: "fix the planner's tools so it can only read, then record the three runs again",
  },
  {
    says: `in ${PASSING_RUNS_NEEDED} or more runs the plan has Steps and its Files name ${THE_FILE}`,
    test: (folder) => enoughRuns(runs(folder), PASSING_RUNS_NEEDED, planNamesTheFile),
    tryNext:
      "read a plan that missed it; tell Claude Code the planner must list each file under " +
      "## Files, written from the app folder",
  },
  {
    says: `in ${PASSING_RUNS_NEEDED} or more runs every planned file exists or says (new)`,
    test: (folder) => enoughRuns(runs(folder), PASSING_RUNS_NEEDED, everyFileIsReal),
    tryNext:
      "ask Claude Code to make the planner check each path with Glob, " +
      "and write (new) after a file that does not exist yet",
  },
] satisfies Rule[];
