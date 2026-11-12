// bun run doctor: is this machine ready? One line per check, then a verdict.
// Required checks decide the exit code. Live checks only matter from Part 2 on, when Claude Code runs for real.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DB_PATH, seed } from "./app/src/db";
import { MIN_CLAUDE_CODE, providerStatus } from "../config/models";

const ROOT = join(import.meta.dir, "..");
type Line = { ok: boolean; says: string; fix: string };
const newer = (have: string, want: string) => {
  const a = have.split(".").map(Number);
  const b = want.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
};
const run = (cmd: string[]) => {
  try {
    const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
    return r.exitCode === 0 ? r.stdout.toString().trim() : null;
  } catch {
    return null;
  }
};

const required: Line[] = [
  { ok: newer(Bun.version, "1.4.0"), says: `Bun ${Bun.version}`, fix: "install Bun 1.4 or newer from bun.sh" },
  { ok: existsSync(join(ROOT, "node_modules", "hono")), says: "packages installed", fix: "run bun install" },
  (() => {
    const had = existsSync(DB_PATH);
    if (!had) seed();
    return { ok: existsSync(DB_PATH), says: had ? "library database built" : "library database built just now", fix: "run bun run world reset" };
  })(),
  {
    ok: process.platform !== "win32",
    says: `platform ${process.platform}`,
    fix: "on Windows, work inside WSL2; hooks and paths assume a Unix shell",
  },
];

const cc = run(["claude", "--version"])?.match(/\d+\.\d+\.\d+/)?.[0];
const prov = providerStatus();
const live: Line[] = [
  {
    ok: Boolean(cc && newer(cc, MIN_CLAUDE_CODE)),
    says: cc ? `Claude Code ${cc}` : "Claude Code not found",
    fix: `install or update it: npm install -g @anthropic-ai/claude-code (at least ${MIN_CLAUDE_CODE})`,
  },
  { ok: prov.ok, says: prov.says, fix: prov.fix },
];

for (const l of required) console.log(`  ${l.ok ? "ok  " : "FAIL"}  ${l.says}${l.ok ? "" : `\n        Try next: ${l.fix}`}`);
for (const l of live) console.log(`  ${l.ok ? "ok  " : "--  "}  ${l.says}${l.ok ? "" : `  (for live runs: ${l.fix})`}`);
const need = required.filter((l) => l.ok).length;
if (need < required.length) {
  console.log(`doctor: not ready, ${need} of ${required.length} required checks pass. Fix the FAIL lines and run it again.`);
  process.exit(1);
}
const liveOk = live.every((l) => l.ok);
console.log(`doctor: ready for replay, ${need} of ${required.length} required checks pass. Live runs: ${liveOk ? "ready" : "not yet, see the -- lines"}.`);
