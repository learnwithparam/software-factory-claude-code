// Stop hook: in the build stage the agent may not stop until the gate passed on the code as it is.
// `bun run gate` writes .factory/gate.json with a hash of src/ and tests/; this hook hashes them
// again and compares. Claude Code sends the event as JSON on stdin, and printing
// {"decision":"block","reason":...} keeps the agent working.
import { createHash, type Hash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rawEvent = await Bun.stdin.text();
keepForReplay(rawEvent);
const event = JSON.parse(rawEvent);

// Only the builder must prove its work.
if (process.env.FACTORY_STAGE !== "build") process.exit(0);
// Claude Code already continued once for this hook; holding it again would loop forever.
if (event.stop_hook_active) process.exit(0);

const project = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();
const gateRecordPath = join(project, ".factory", "gate.json");

if (!existsSync(gateRecordPath)) {
  keepWorking("Run bun run gate before you stop. There is no gate record for this change yet.");
}
const gateRecord = JSON.parse(readFileSync(gateRecordPath, "utf8"));
if (gateRecord.exit_code !== 0) {
  keepWorking(
    "The gate failed on your last change. Read the failing test and fix the code under src/.",
  );
}
if (gateRecord.tree !== treeHash(project)) {
  keepWorking(
    "The code changed after the last gate run. Run bun run gate again on the code as it is now.",
  );
}
process.exit(0);

// The finished factory keeps every event Claude Code sends, so a replay can run the hook again.
function keepForReplay(rawEvent: string): void {
  const logFile = process.env.FACTORY_HOOK_LOG;
  try {
    if (logFile) appendFileSync(logFile, `${rawEvent.trim()}\n`);
  } catch {}
}

// Tell Claude Code not to stop yet, and why.
function keepWorking(reason: string): never {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

// The same hash as the gate's treeHash: every file under src/ and tests/, by path and content.
export function treeHash(projectDir: string): string {
  const hash = createHash("sha256");
  addFolder(hash, projectDir, join(projectDir, "src"));
  addFolder(hash, projectDir, join(projectDir, "tests"));
  return hash.digest("hex").slice(0, 12);
}

function addFolder(hash: Hash, projectDir: string, folder: string): void {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder).sort()) {
    const entryPath = join(folder, entry);
    if (statSync(entryPath).isDirectory()) {
      addFolder(hash, projectDir, entryPath);
    } else {
      hash.update(relative(projectDir, entryPath)).update(readFileSync(entryPath));
    }
  }
}
