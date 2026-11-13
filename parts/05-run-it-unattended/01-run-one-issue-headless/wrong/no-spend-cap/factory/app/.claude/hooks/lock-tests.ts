// PreToolUse hook: in the build stage, test files are locked. The test says what the issue asks
// for; the builder changes the code until the test passes, never the other way round.
// Claude Code sends the event as JSON on stdin. Exit 2 blocks the tool call, and Claude Code
// hands the text on stderr back to the agent as the reason.
import { appendFileSync } from "node:fs";

const TEST_FILE = /(^|\/)tests?\/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$/;
const FILE_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const SHELL_WRITE = /(\bsed\s+-i|\brm\b|\bmv\b|\bcp\b|>|\btee\b|git\s+(checkout|restore)\b)/;
const SHELL_TEST_TARGET = /\S*(tests?\/\S+|\S+\.test\.[jt]sx?)/;

const rawEvent = await Bun.stdin.text();
keepForReplay(rawEvent);
const event = JSON.parse(rawEvent);
const stage = process.env.FACTORY_STAGE ?? "";
const testFile = testFileTouchedBy(event.tool_name ?? "", event.tool_input ?? {});

if (stage === "build" && testFile) {
  console.error(
    `Blocked: ${testFile} is a test file and tests are locked in the build stage. ` +
      "The test states what the issue asks for. Change the code under src/ until it passes.",
  );
  process.exit(2);
}
process.exit(0);

// The finished factory keeps every event Claude Code sends, so a replay can run the hook again.
function keepForReplay(rawEvent: string): void {
  const logFile = process.env.FACTORY_HOOK_LOG;
  try {
    if (logFile) appendFileSync(logFile, `${rawEvent.trim()}\n`);
  } catch {}
}

// The test file this tool call would change, or "" when it changes none.
function testFileTouchedBy(tool: string, input: Record<string, unknown>): string {
  const filePath = String(input.file_path ?? "");
  if (FILE_TOOLS.includes(tool) && TEST_FILE.test(filePath)) return filePath;
  if (tool !== "Bash") return "";

  const command = String(input.command ?? "");
  const writes = SHELL_WRITE.test(command);
  const target = command.match(SHELL_TEST_TARGET)?.[0];
  if (writes && target) return target;
  return "";
}
