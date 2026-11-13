// Stop hook: in the build stage, Claude may not stop
// until the gate passed on the code as it is now.
// Reads .factory/gate.json (written by `bun run gate`) and compares its tree to a fresh hash.
// To block, prints {"decision":"block","reason":...}. Exit 0 with no output allows the stop.
import { createHash, type Hash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// biome-ignore-start lint/style/useNamingConvention: Claude Code and the gate name these keys.
type StopEvent = { stop_hook_active?: boolean };
type GateRecord = { exit_code?: number; tree?: string };
// biome-ignore-end lint/style/useNamingConvention: the keys end here.

async function readEvent(): Promise<StopEvent | null> {
  try {
    return (await Bun.stdin.json()) as StopEvent;
  } catch {
    return null;
  }
}

function projectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

// Same walk as treeHash in world/gate.ts, so the hashes match.
function addFolderToHash(hash: Hash, root: string, folder: string): void {
  if (!existsSync(folder)) return;
  const entries = readdirSync(folder).sort();
  for (const entry of entries) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) {
      addFolderToHash(hash, root, path);
    } else {
      hash.update(relative(root, path));
      hash.update(readFileSync(path));
    }
  }
}

function treeHash(root: string): string {
  const hash = createHash("sha256");
  addFolderToHash(hash, root, join(root, "src"));
  addFolderToHash(hash, root, join(root, "tests"));
  return hash.digest("hex").slice(0, 12);
}

function readRecord(root: string): GateRecord | null {
  try {
    return JSON.parse(readFileSync(join(root, ".factory", "gate.json"), "utf8")) as GateRecord;
  } catch {
    return null;
  }
}

function blockReason(root: string): string | null {
  const record = readRecord(root);
  if (!record) {
    return (
      "No gate result at .factory/gate.json. " +
      "Run `bun run gate` and fix any failures before stopping."
    );
  }
  if (record.exit_code !== 0) {
    return (
      `The last \`bun run gate\` failed (exit_code ${record.exit_code}). ` +
      "Fix the code under src/ until `bun run gate` passes, then stop."
    );
  }
  const tree = treeHash(root);
  if (record.tree !== tree) {
    return (
      `src/ or tests/ changed since the last gate (gate tree ${record.tree}, now ${tree}). ` +
      "Run `bun run gate` again on the current code before stopping."
    );
  }
  return null;
}

function block(reason: string): never {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

async function main(): Promise<void> {
  if (process.env.FACTORY_STAGE !== "build") process.exit(0);
  const event = await readEvent();
  if (event?.stop_hook_active === true) process.exit(0);
  const reason = blockReason(projectDir());
  if (reason) block(reason);
  process.exit(0);
}

await main();
