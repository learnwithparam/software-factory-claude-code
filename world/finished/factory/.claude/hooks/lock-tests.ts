// PreToolUse hook: in the build stage, test files are locked. The test says what the issue asks for;
// the builder changes the code until the test passes, never the other way round.
// Claude Code sends the event as JSON on stdin. Exit 2 blocks the tool call, and Claude Code hands the
// text on stderr back to the agent as the reason.
import { appendFileSync } from "node:fs";

const raw = await Bun.stdin.text();
// The finished factory keeps every event Claude Code sends, so a replay can run the hook on it again.
try {
  if (process.env.FACTORY_HOOK_LOG) appendFileSync(process.env.FACTORY_HOOK_LOG, `${raw.trim()}\n`);
} catch {}
const event = JSON.parse(raw);
const stage = process.env.FACTORY_STAGE ?? "";
const TEST = /(^|\/)tests?\/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$/;
const input = event.tool_input ?? {};
const tool: string = event.tool_name ?? "";

let touches = "";
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool) && TEST.test(String(input.file_path ?? ""))) touches = input.file_path;
if (tool === "Bash") {
  const cmd = String(input.command ?? "");
  const writes = /(\bsed\s+-i|\brm\b|\bmv\b|\bcp\b|>|\btee\b|git\s+(checkout|restore)\b)/.test(cmd);
  const target = cmd.match(/\S*(tests?\/\S+|\S+\.test\.[jt]sx?)/)?.[0];
  if (writes && target) touches = target;
}

if (stage === "build" && touches) {
  console.error(
    `Blocked: ${touches} is a test file and tests are locked in the build stage. The test states what the issue asks for. Change the code under src/ until it passes.`,
  );
  process.exit(2);
}
process.exit(0);
