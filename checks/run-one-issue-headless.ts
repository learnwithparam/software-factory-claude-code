// run-one-issue-headless: factory/run.ts answers the factory contract with nobody at the keyboard.
// The dry runs need no model and no key: they show the flags, the stages and the retry limit.
// The live run of issue 1 is read from what Claude Code printed, never from a reply.

import {
  claudeLines,
  dryRun,
  factoryCode,
  hasFactoryScript,
  liveRun,
  readsLikeOneStage,
} from "../parts/05-run-it-unattended/factory-checks";
import type { Rule } from "../scripts/verify";
import { ranCommand, readSession } from "./lib/session";

const STAGES_FOR_A_READY_ISSUE = ["triage", "spec", "build", "review"];
const PERMISSION = /--permission-mode\s+\S+|--allowedTools\s+\S+/;
const OUTPUT = /--output-format\s+'?(json|stream-json)\b/;
const SKIPS_THE_GATES = /--bare\b|--dangerously-skip-permissions|bypassPermissions/;

function issueOneDryRun(folder: string) {
  return dryRun(folder, 1);
}

function everyLineIsCapped(folder: string): boolean {
  const lines = claudeLines(issueOneDryRun(folder));
  if (lines.length === 0) return false;
  return lines.every((line) => {
    const capped = line.includes("--max-turns") && line.includes("--max-budget-usd");
    return capped && PERMISSION.test(line) && OUTPUT.test(line);
  });
}

function nothingSkipsTheGates(folder: string): boolean {
  const lines = claudeLines(issueOneDryRun(folder));
  if (lines.length === 0) return false;
  const code = factoryCode(folder);
  return !SKIPS_THE_GATES.test(code) && lines.every((line) => !SKIPS_THE_GATES.test(line));
}

function issueOneEndsAsDraft(folder: string): boolean {
  const result = issueOneDryRun(folder).result;
  if (!result) return false;
  const shaped = result.state === "draft_pr" && result.branch === "factory/issue-1";
  return shaped && result.pr_url === null && result.cost_usd === 0 && result.gate?.exit_code === 0;
}

function everyStageRuns(folder: string): boolean {
  const lines = claudeLines(issueOneDryRun(folder));
  return STAGES_FOR_A_READY_ISSUE.every((stage) =>
    lines.some((line) => readsLikeOneStage(line, stage)),
  );
}

function issueSixStopsAtTriage(folder: string): boolean {
  const run = dryRun(folder, 6);
  const lines = claudeLines(run);
  const onlyTriage = lines.length === 1 && readsLikeOneStage(lines[0], "triage");
  return run.result?.state === "refused" && onlyTriage;
}

function retryStopsAtTwo(folder: string): boolean {
  // biome-ignore lint/style/useNamingConvention: the factory contract names this variable.
  const run = dryRun(folder, 1, { FACTORY_DRY_GATE: "fail" });
  const buildLines = claudeLines(run).filter((line) => readsLikeOneStage(line, "build"));
  const stopped = run.result?.state === "gate_failed" && run.result.gate?.rounds === 2;
  return stopped && buildLines.length === 2;
}

function issueOneRanLive(folder: string): boolean {
  const live = liveRun(folder, 1);
  if (!live.result || live.transcriptCosts.length < 4) return false;
  const green = live.result.state === "draft_pr" && live.result.gate?.exit_code === 0;
  return green && live.costMatches && live.result.cost_usd > 0;
}

export default [
  {
    says: "package.json has a factory script that runs factory/run.ts",
    test: hasFactoryScript,
    tryNext: "ask Claude Code to write factory/run.ts and keep the factory script in package.json",
  },
  {
    says: "bun run factory 1 --dry-run --json prints one result that matches the contract",
    test: (folder) => issueOneDryRun(folder).matchesContract,
    tryNext:
      "ask Claude Code to print only the result JSON on stdout with --json, " +
      "in the shape of checks/lib/result.ts, and to send progress to stderr",
  },
  {
    says: "the dry run saves the same result to runs/1/result.json",
    test: (folder) => issueOneDryRun(folder).savedMatchesPrinted,
    tryNext: "ask Claude Code to write the result it prints to <runs>/<issue>/result.json as well",
  },
  {
    says: "issue 1's dry run ends as draft_pr on factory/issue-1, gate green, no PR and no cost",
    test: issueOneEndsAsDraft,
    tryNext:
      "a dry run makes no claude call: ask Claude Code for pr_url null, cost_usd 0, " +
      "and the real gate run on the copy",
  },
  {
    says: "commands.txt lists one claude -p call for each stage: triage, spec, build, review",
    test: everyStageRuns,
    tryNext:
      "ask Claude Code to write each claude -p line it would run to commands.txt, " +
      "with the prompt replaced by its stage file name",
  },
  {
    says: "every claude -p call names its permissions, caps turns and spend, and asks for JSON",
    test: everyLineIsCapped,
    tryNext:
      "each call needs --permission-mode or --allowedTools, --max-turns, --max-budget-usd " +
      "and --output-format stream-json; ask Claude Code which one is missing",
  },
  {
    says: "nothing uses --bare or skips permissions, so the hooks still run",
    test: nothingSkipsTheGates,
    tryNext:
      "--bare skips the project's hooks, and the hooks are the gates; " +
      "ask Claude Code to remove it",
  },
  {
    says: "issue 6 is refused at triage, and nothing after triage runs",
    test: issueSixStopsAtTriage,
    tryNext:
      "factory/backlog.json refuses issue 6; ask Claude Code to end the run as refused " +
      "right after triage",
  },
  {
    says: "when the gate keeps failing, the builder gets 2 rounds and the run ends gate_failed",
    test: retryStopsAtTwo,
    tryNext:
      "run FACTORY_DRY_GATE=fail bun run factory 1 --dry-run --json and count the build lines; " +
      "ask Claude Code to stop after round 2",
  },
  {
    says: "a live run of issue 1 ended in draft_pr, and its cost matches its transcripts",
    test: issueOneRanLive,
    tryNext:
      "run bun run factory 1 --json with Claude Code signed in, then read runs/1/result.json; " +
      "cost_usd must be the sum of total_cost_usd in runs/1/transcripts",
  },
  {
    says: "your saved session shows you set a repeat with /loop",
    test: (folder) => ranCommand(readSession(folder), "loop"),
    tryNext: "type /loop with a short interval and the dry-run command, then save the session",
  },
  {
    says: "every claude -p call sets a permission mode, not only a tool list",
    test: (folder) => {
      const lines = claudeLines(issueOneDryRun(folder));
      return lines.length > 0 && lines.every((line) => /--permission-mode\s+\S+/.test(line));
    },
    tryNext:
      "add --permission-mode dontAsk or --permission-mode acceptEdits to each claude -p call",
  },
] satisfies Rule[];
