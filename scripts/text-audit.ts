// bun run text-audit: opens every route in a real browser and runs the 10 text checks.
// A repo with no e2e/routes.ts has no pages yet, so there is nothing to audit.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./structure";

const routesFile = join(ROOT, "e2e", "routes.ts");

if (!existsSync(routesFile)) {
  console.log("Text audit skipped: e2e/routes.ts does not exist yet.");
  console.log("Try next: copy e2e/routes.example.ts to e2e/routes.ts when the course has pages.");
  process.exit(0);
}

const configFile = join(ROOT, "e2e", "playwright.config.ts");
// CI runs bun run check without an install step, so the audit gets its own packages first.
const packages = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], { cwd: ROOT });
if (packages.exitCode !== 0) {
  console.error("Could not install the packages. Try next: run bun install, then rerun.");
  process.exit(2);
}
const install = Bun.spawnSync(["bunx", "playwright", "install", "chromium"], { cwd: ROOT });
if (install.exitCode !== 0 && !process.env.AUDIT_BROWSER) {
  console.error("Could not get the browser. Try next: run bunx playwright install chromium.");
  process.exit(2);
}
// The audit runs against a throwaway copy of the library, so it never touches world/data.
const port = process.env.AUDIT_PORT ?? "3917";
const scratch = mkdtempSync(join(tmpdir(), "text-audit-"));
const dbFile = join(scratch, "library.sqlite");
const buildWorld = `bun ${join(ROOT, "world", "world.ts")} > /dev/null`;
const serveApp = `PORT=${port} bun ${join(ROOT, "world", "app", "src", "server.ts")}`;
const startCommand = `${buildWorld} && ${serveApp}`;
const audit = Bun.spawnSync(["bunx", "playwright", "test", "-c", configFile, "--trace", "off"], {
  cwd: ROOT,
  env: {
    ...process.env,
    // biome-ignore lint/style/useNamingConvention: these are environment variable names
    LIBRARY_DB: dbFile,
    // biome-ignore lint/style/useNamingConvention: these are environment variable names
    AUDIT_URL: `http://localhost:${port}`,
    // biome-ignore lint/style/useNamingConvention: these are environment variable names
    AUDIT_SERVER: startCommand,
  },
  stdout: "inherit",
  stderr: "inherit",
});
if (audit.exitCode !== 0) {
  console.error("The text audit found problems. Try next: fix the lines marked above, then rerun.");
}
rmSync(scratch, { recursive: true, force: true });
process.exit(audit.exitCode === 0 ? 0 : 1);
