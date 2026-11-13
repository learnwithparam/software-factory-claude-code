// Helpers the Part 6 checks share, the same file as Part 5 has: dry runs and live runs.
// A dry run writes into a throwaway runs folder (FACTORY_RUNS), so the learner's own runs stay.
// The supervisor may move this file to checks/lib/.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { json, read } from "../../checks/lib/files";
import { parseResult, type Result } from "../../checks/lib/result";
import { runCommand } from "../../checks/lib/run";

export type DryRun = {
  exitCode: number;
  result: Result | null;
  matchesContract: boolean;
  savedMatchesPrinted: boolean;
  commands: string;
};

const dryRunsSeen = new Map<string, DryRun>();

function parsePrinted(stdout: string): unknown {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

function runOnce(folder: string, issue: number, extraEnv: Record<string, string>): DryRun {
  const runsFolder = mkdtempSync(join(tmpdir(), "factory-runs-"));
  const command = ["bun", "run", "factory", String(issue), "--dry-run", "--json"];
  // biome-ignore lint/style/useNamingConvention: the factory contract names this variable.
  const env = { ...extraEnv, FACTORY_RUNS: runsFolder };
  const ran = runCommand(command, { cwd: folder, env });
  const printed = parsePrinted(ran.stdout);
  const parsed = parseResult(printed);
  const saved = json(join(runsFolder, String(issue), "result.json"));
  const commands = read(join(runsFolder, String(issue), "commands.txt")) ?? "";
  rmSync(runsFolder, { recursive: true, force: true });
  return {
    exitCode: ran.code,
    result: parsed.ok ? parsed.result : null,
    matchesContract: ran.code === 0 && parsed.ok,
    savedMatchesPrinted: parsed.ok && JSON.stringify(saved) === JSON.stringify(printed),
    commands,
  };
}

// The same dry run is asked for by several rules, so each one runs once per folder.
export function dryRun(folder: string, issue: number, extraEnv: Record<string, string> = {}) {
  const key = JSON.stringify([folder, issue, extraEnv]);
  const seen = dryRunsSeen.get(key);
  if (seen) return seen;
  const fresh = runOnce(folder, issue, extraEnv);
  dryRunsSeen.set(key, fresh);
  return fresh;
}

export function claudeLines(run: DryRun): string[] {
  const lines = run.commands.split("\n");
  return lines.filter((line) => /\bclaude\s+-p\b/.test(line));
}

// A commands.txt line belongs to a stage when it sets FACTORY_STAGE or names the stage's prompt.
export function readsLikeOneStage(line: string, stage: string): boolean {
  return line.includes(`FACTORY_STAGE=${stage} `) || line.includes(`stages/${stage}.md`);
}

// The runner code without comments: a comment that warns against --bare is not a use of it.
export function factoryCode(folder: string): string {
  const code = read(join(folder, "factory", "run.ts")) ?? "";
  const lines = code.split("\n");
  const codeLines = lines.filter((line) => !line.trim().startsWith("//"));
  return codeLines.join("\n");
}

export function hasFactoryScript(folder: string): boolean {
  const manifest = json<{ scripts?: Record<string, string> }>(join(folder, "package.json"));
  const script = manifest?.scripts?.factory ?? "";
  return script.includes("factory/run.ts") && existsSync(join(folder, "factory", "run.ts"));
}

// The cost Claude Code reported at the end of one transcript: the result line's total_cost_usd.
export function transcriptCost(path: string): number | null {
  const text = read(path);
  if (text === null) return null;
  const lines = text.trim().split("\n").reverse();
  for (const line of lines) {
    // biome-ignore lint/style/useNamingConvention: Claude Code writes total_cost_usd.
    const event = parsePrinted(line) as { type?: string; total_cost_usd?: number } | null;
    if (event?.type === "result") return Number(event.total_cost_usd ?? 0);
  }
  return null;
}

export type LiveRun = { result: Result | null; transcriptCosts: number[]; costMatches: boolean };

// A live run is a result that is not replayed, with one transcript per claude -p call.
// Its cost must be the sum of what Claude Code reported, not a number the run made up.
export function liveRun(folder: string, issue: number): LiveRun {
  const runFolder = join(folder, "runs", String(issue));
  const parsed = parseResult(json(join(runFolder, "result.json")));
  if (!parsed.ok || parsed.result.replayed) {
    return { result: null, transcriptCosts: [], costMatches: false };
  }
  const calls = parsed.result.claude_runs ?? [];
  const costs = calls.map((call) => transcriptCost(join(runFolder, call.transcript)));
  const known = costs.filter((cost): cost is number => cost !== null);
  const total = known.reduce((sum, cost) => sum + cost, 0);
  const allFound = known.length === calls.length && calls.length > 0;
  const costMatches = allFound && Math.abs(total - parsed.result.cost_usd) < 0.001;
  return { result: parsed.result, transcriptCosts: known, costMatches };
}

// biome-ignore lint/style/useNamingConvention: Claude Code names this field file_path.
type ToolUse = { type?: string; name?: string; input?: { file_path?: string } };
type TranscriptLine = { type?: string; message?: { content?: ToolUse[] } };

const FILE_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];

function editedFile(block: ToolUse): string | null {
  const editsFile = block.type === "tool_use" && FILE_TOOLS.includes(block.name ?? "");
  if (!editsFile) return null;
  return block.input?.file_path ?? null;
}

function filesEditedIn(transcriptPath: string): string[] {
  const lines = (read(transcriptPath) ?? "").split("\n");
  const events = lines.map((line) => parsePrinted(line) as TranscriptLine | null);
  const replies = events.filter((event) => event?.type === "assistant");
  const blocks = replies.flatMap((event) => event?.message?.content ?? []);
  const files = blocks.map(editedFile);
  return files.filter((file): file is string => file !== null);
}

// Every app file Claude Code edited in a live run, read from its transcripts,
// as a path inside the copy: "src/loans/reserve.ts".
export function filesChangedInRun(folder: string, issue: number): string[] {
  const live = liveRun(folder, issue);
  const runFolder = join(folder, "runs", String(issue));
  const calls = live.result?.claude_runs ?? [];
  const paths = calls.flatMap((call) => filesEditedIn(join(runFolder, call.transcript)));
  const insideCopy = paths.map((path) => path.replace(/^.*\/repo\//, ""));
  return [...new Set(insideCopy)];
}
