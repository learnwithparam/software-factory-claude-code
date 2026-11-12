// What the checks know about the world: the repo root, the app, the backlog and the gate.
import { join } from "node:path";
import { listFiles } from "./files";

export const ROOT = join(import.meta.dir, "..", "..");
export const WORLD = join(ROOT, "world");
export const APP = join(WORLD, "app");
export { answers, type Issue, issue, issues, parseIssue } from "../../world/backlog";

// Paths in the app as the learner names them: "src/fees/split.ts", "tests/fees/split.test.ts".
export const appFiles = () => listFiles(APP).filter((f) => !f.startsWith("node_modules"));
export const PROTECTED = ["src/auth/"];

// Run the gate on any copy of the app. Returns the parsed record the gate writes.
export async function runGate(
  appDir = APP,
): Promise<{ exit_code: number; tree: string; passed: number; failed: number }> {
  const out = join(appDir, ".gate.json");
  Bun.spawnSync(["bun", join(WORLD, "gate.ts"), appDir, "--record", out], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return JSON.parse(await Bun.file(out).text());
}
