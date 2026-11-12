// Stop hook: in the build stage the agent may not stop until the gate passed on the code as it is now.
// `bun run gate` writes .factory/gate.json with a hash of src/ and tests/; this hook hashes them again and
// compares. Claude Code sends the event as JSON on stdin; {"decision":"block","reason":...} keeps it working.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raw = await Bun.stdin.text();
// The finished factory keeps every event Claude Code sends, so a replay can run the hook on it again.
try {
  if (process.env.FACTORY_HOOK_LOG) appendFileSync(process.env.FACTORY_HOOK_LOG, `${raw.trim()}\n`);
} catch {}
const event = JSON.parse(raw);
if (process.env.FACTORY_STAGE !== "build") process.exit(0); // only the builder must prove its work
if (event.stop_hook_active) process.exit(0); // Claude Code already continued once for this hook; never loop

// The same hash as the gate's treeHash: every file under src/ and tests/, by path and content.
export function treeHash(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(relative(dir, p)).update(readFileSync(p));
    }
  };
  walk(join(dir, "src"));
  walk(join(dir, "tests"));
  return h.digest("hex").slice(0, 12);
}

const project = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();
const recordPath = join(project, ".factory", "gate.json");
const block = (reason: string) => {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
};
if (!existsSync(recordPath)) block("Run bun run gate before you stop. There is no gate record for this change yet.");
const rec = JSON.parse(readFileSync(recordPath, "utf8"));
if (rec.exit_code !== 0) block("The gate failed on your last change. Read the failing test and fix the code under src/.");
if (rec.tree !== treeHash(project)) block("The code changed after the last gate run. Run bun run gate again on the code as it is now.");
process.exit(0);
