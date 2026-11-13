// What the checks know about the world: the repo root, the app, the backlog and the gate.
import { join } from "node:path";
import { listFiles } from "./files";

export const ROOT = join(import.meta.dir, "..", "..");
export const WORLD = join(ROOT, "world");
export const APP = join(WORLD, "app");
export { answers, type Issue, issue, issues, parseIssue } from "../../world/backlog";

// Paths in the app as the learner names them: "src/fees/split.ts", "tests/fees/split.test.ts".
export const appFiles = () => listFiles(APP).filter((path) => !path.startsWith("node_modules"));
export const PROTECTED = ["src/auth/"];

// biome-ignore lint/style/useNamingConvention: the gate writes exit_code in snake_case.
type GateRecord = { exit_code: number; tree: string; passed: number; failed: number };

// Run the gate on any copy of the app. Returns the parsed record the gate writes.
export async function runGate(appFolder = APP): Promise<GateRecord> {
  const recordPath = join(appFolder, ".gate.json");
  Bun.spawnSync(["bun", join(WORLD, "gate.ts"), appFolder, "--record", recordPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return JSON.parse(await Bun.file(recordPath).text());
}
