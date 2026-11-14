// Read a saved Claude Code session: evidence/session.jsonl, one JSON entry per line.
// The learner saves it with: bun run save-session <step folder>
// Each helper answers one question a ladder rule asks, such as "did you run /clear".
import { join } from "node:path";
import { read } from "./files";

type Block = { type?: string; name?: string; text?: string; input?: Record<string, unknown> };
export type Entry = {
  type?: string;
  permissionMode?: string;
  message?: { role?: string; content?: string | Block[] };
  attachment?: { type?: string };
};

export function readSession(folder: string): Entry[] {
  const text = read(join(folder, "evidence", "session.jsonl")) ?? "";
  const entries: Entry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as Entry);
    } catch {
      // A damaged line is skipped, so the rule that needs it fails with a clear message.
    }
  }
  return entries;
}

const blocksOf = (entry: Entry): Block[] => {
  const content = entry.message?.content;
  return Array.isArray(content) ? content : [];
};

// The words a person typed in one user entry.
export function userText(entry: Entry): string {
  if (entry.type !== "user" || entry.message?.role !== "user") return "";
  const content = entry.message.content;
  if (typeof content === "string") return content;
  return blocksOf(entry)
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
}

export const userPrompts = (entries: Entry[]) => entries.map(userText).filter(Boolean);

// Claude Code records a slash command as <command-name>/clear</command-name>.
export function ranCommand(entries: Entry[], command: string): boolean {
  const tag = `<command-name>/${command}</command-name>`;
  return entries.some((entry) => userText(entry).includes(tag));
}

export const usedPlanMode = (entries: Entry[]) =>
  entries.some((entry) => entry.permissionMode === "plan");

export const usedAnotherMode = (entries: Entry[]) =>
  entries.some((entry) => entry.permissionMode && entry.permissionMode !== "default");

export const mentionedFile = (entries: Entry[]) =>
  entries.some(
    (entry) => entry.attachment?.type === "file" || /(^|\s)@[\w./-]+\.\w+/.test(userText(entry)),
  );

export const attachedImage = (entries: Entry[]) =>
  entries.some((entry) => blocksOf(entry).some((block) => block.type === "image"));

export const pressedEsc = (entries: Entry[]) =>
  entries.some((entry) => userText(entry).includes("[Request interrupted by user"));

export function calledTool(entries: Entry[], tool: string): Block[] {
  const blocks = entries.flatMap(blocksOf);
  return blocks.filter((block) => block.type === "tool_use" && block.name === tool);
}

// The Agent tool starts a subagent; older sessions call it Task.
export const subagentCalls = (entries: Entry[]) => [
  ...calledTool(entries, "Agent"),
  ...calledTool(entries, "Task"),
];
