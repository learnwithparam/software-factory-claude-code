// PreToolUse hook: in the build stage, tests are locked.
// Blocks Edit/Write of a test file, and Bash commands that write to one.
// Exit 0 allows the call. Exit 2 blocks it; stderr is the reason Claude sees.

// biome-ignore-start lint/style/useNamingConvention: Claude Code names these event keys.
type ToolInput = { file_path?: string; command?: string };
type HookEvent = { tool_name?: string; tool_input?: ToolInput };
// biome-ignore-end lint/style/useNamingConvention: the event keys end here.

const writingCommands = new Set(["mv", "cp", "rm", "tee", "truncate", "touch", "ln", "dd"]);

async function readEvent(): Promise<HookEvent | null> {
  try {
    return (await Bun.stdin.json()) as HookEvent;
  } catch {
    return null;
  }
}

function isTestPath(path: string): boolean {
  const normal = path.replaceAll("\\", "/");
  if (normal.endsWith(".test.ts")) return true;
  return normal.startsWith("tests/") || normal.includes("/tests/") || normal === "tests";
}

function unquote(word: string): string {
  return word.replace(/^['"]+|['"]+$/g, "");
}

function splitWords(command: string): string[] {
  return command
    .split(/\s+|;|&&|\|\||\|/)
    .map(unquote)
    .filter((word) => word.length > 0);
}

function redirectTarget(word: string): string | null {
  const match = word.match(/>>?([^>]*)$/);
  return match ? unquote(match[1]) : null;
}

function redirectsIntoTest(words: string[]): string | null {
  for (let index = 0; index < words.length; index++) {
    const target = redirectTarget(words[index]);
    if (target === null) continue;
    const path = target || words[index + 1] || "";
    if (isTestPath(path)) return path;
  }
  return null;
}

function isInPlaceFlag(word: string): boolean {
  return word.startsWith("-i") || word === "--in-place";
}

function isWriteCommand(words: string[]): boolean {
  if (words.some((word) => writingCommands.has(word))) return true;
  const editsInPlace = words.includes("sed") || words.includes("perl");
  return editsInPlace && words.some(isInPlaceFlag);
}

function testPathIn(words: string[]): string | null {
  for (const word of words) {
    const path = word.startsWith("of=") ? word.slice(3) : word;
    if (isTestPath(path)) return path;
  }
  return null;
}

function commandTouchesTest(command: string): string | null {
  const words = splitWords(command);
  const redirected = redirectsIntoTest(words);
  if (redirected) return redirected;
  return isWriteCommand(words) ? testPathIn(words) : null;
}

function editTouchesTest(input: ToolInput): string | null {
  const path = input.file_path ?? "";
  return isTestPath(path) ? path : null;
}

function findLockedTest(event: HookEvent): string | null {
  const input = event.tool_input ?? {};
  if (event.tool_name === "Edit" || event.tool_name === "Write") return editTouchesTest(input);
  if (event.tool_name === "Bash") return commandTouchesTest(input.command ?? "");
  return null;
}

function block(path: string): never {
  console.error(
    `Blocked: tests are locked in the build stage. Do not change ${path}. ` +
      "Change the code under src/ so the test passes, and leave the test alone.",
  );
  process.exit(2);
}

async function main(): Promise<void> {
  const event = await readEvent();
  if (!event) process.exit(0);
  const lockedTest = findLockedTest(event);
  if (lockedTest) block(lockedTest);
  process.exit(0);
}

await main();
