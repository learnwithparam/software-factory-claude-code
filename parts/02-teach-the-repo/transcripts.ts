// Read the stream-json transcript of a real `claude -p` run, one JSON event per line.
// The checks for this part read what Claude Code did and replied, never a model's reply alone:
// the init event says which Claude Code ran and which skills it loaded,
// the tool calls say what it touched, and the result event holds its final answer.
// Kept in this part folder for now; the course's checks/lib is the place it belongs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// biome-ignore-start lint/style/useNamingConvention: Claude Code's stream-json keys are snake_case.
type StreamEvent = {
  type?: string;
  subtype?: string;
  claude_code_version?: string;
  skills?: string[];
  agents?: string[];
  result?: unknown;
  message?: { content?: { type?: string; name?: string }[] };
};
// biome-ignore-end lint/style/useNamingConvention: the stream-json type ends here.

export type Transcript = { file: string; events: StreamEvent[] };

function parseLine(line: string): StreamEvent | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function readTranscript(file: string): Transcript {
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const events = lines.map(parseLine).filter((event): event is StreamEvent => event !== null);
  return { file, events };
}

// Every run-*.jsonl in a folder, in name order.
export function transcriptsIn(folder: string): Transcript[] {
  if (!existsSync(folder)) return [];
  const files = readdirSync(folder).filter((name) => /^run-.*\.jsonl$/.test(name));
  return files.sort().map((name) => readTranscript(join(folder, name)));
}

export function initEvent(transcript: Transcript): StreamEvent | undefined {
  return transcript.events.find((event) => event.type === "system" && event.subtype === "init");
}

// A real run starts with Claude Code's init event and ends with a result event.
export function isRealRun(transcript: Transcript): boolean {
  const version = initEvent(transcript)?.claude_code_version ?? "";
  const hasResult = transcript.events.some((event) => event.type === "result");
  return /^\d+\.\d+\.\d+$/.test(version) && hasResult;
}

export function finalReply(transcript: Transcript): string {
  const resultEvent = transcript.events.findLast((event) => event.type === "result");
  return typeof resultEvent?.result === "string" ? resultEvent.result : "";
}

// The names of every tool Claude Code called in the run, such as "Read" or "Edit".
export function toolsCalled(transcript: Transcript): string[] {
  const assistantEvents = transcript.events.filter((event) => event.type === "assistant");
  const blocks = assistantEvents.flatMap((event) => event.message?.content ?? []);
  const toolCalls = blocks.filter((block) => block.type === "tool_use");
  return toolCalls.map((block) => String(block.name));
}

// True when at least `needed` of the runs pass the test.
export function enoughRuns(
  transcripts: Transcript[],
  needed: number,
  passes: (transcript: Transcript) => boolean,
): boolean {
  return transcripts.filter(passes).length >= needed;
}
