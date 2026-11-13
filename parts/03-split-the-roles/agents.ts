// Read a subagent file in .claude/agents/: its frontmatter tools and model, and its prompt.
// Kept in this part folder for now; the course's checks/lib is the place it belongs.
import { join } from "node:path";
import { frontmatter } from "../../checks/lib/files";

export const WRITING_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
export const MODEL_ALIASES = ["haiku", "sonnet", "opus", "fable", "inherit"];

export function agent(folder: string, name: string) {
  return frontmatter(join(folder, ".claude", "agents", `${name}.md`));
}

// A tool list may be a YAML list or one string split by commas or spaces.
// A space inside brackets, as in Bash(git diff *), belongs to the tool.
export function toolList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tool) => String(tool).trim());
  if (typeof value !== "string") return [];
  return value.match(/[A-Za-z]+(\([^)]*\))?/g) ?? [];
}

export function agentTools(folder: string, name: string): string[] {
  return toolList(agent(folder, name)?.data.tools);
}

// The bare tool names, so "Bash(git diff *)" counts as "Bash".
export function toolNames(tools: string[]): string[] {
  return tools.map((tool) => tool.replace(/\(.*$/, ""));
}

// True when the agent names a tool list and none of its tools can change a file or run any command.
export function readsOnly(tools: string[]): boolean {
  const changesFiles = toolNames(tools).some((tool) => WRITING_TOOLS.includes(tool));
  return tools.length > 0 && !changesFiles && !tools.includes("Bash");
}
