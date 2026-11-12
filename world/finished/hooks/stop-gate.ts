// Stop hook: the agent may not stop until the gate passed on the code as it is now.
// It reads the gate record ($FACTORY_RUN_DIR/gate.json) and compares its tree hash with the app's current tree.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { treeHash } from "../../gate";

const event = JSON.parse(await Bun.stdin.text());
if (event.stop_hook_active) process.exit(0); // already continued once for this reason; never loop

const runDir = process.env.FACTORY_RUN_DIR ?? "";
const appDir = process.env.FACTORY_APP_DIR ?? "";
const recordPath = join(runDir, "gate.json");
const block = (reason: string) => {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
};
if (!existsSync(recordPath)) block("Run bun run gate with --record before you stop. There is no gate record for this run.");
const rec = JSON.parse(readFileSync(recordPath, "utf8"));
if (rec.exit_code !== 0) block("The gate failed on your last change. Read the failing test and fix the code.");
if (rec.tree !== treeHash(appDir)) block("The code changed after the last gate run. Run the gate again on the code as it is now.");
process.exit(0);
