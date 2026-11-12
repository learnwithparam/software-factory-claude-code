// bun run doctor: is this machine ready? One line per check, then a verdict.
// Required checks decide the exit code. The Claude Code lines come from claude itself (`claude --version`
// and `claude auth status`); the doctor never reads a credentials file. Without them the course still
// replays its recorded runs, so they are listed but do not fail the doctor.
import { existsSync } from "node:fs";
import { claudeStatus, INSTALL, MIN_CLAUDE_CODE, recentEnough } from "../config/claude-code";
import { DB_PATH, seed } from "../world/app/src/db";

type Line = { ok: boolean; says: string; fix: string };
// Packages count as installed when they load. Bun can also install them on first import, as CI does.
const canLoad = async (names: string[]) => {
  try {
    for (const n of names) await import(n);
    return true;
  } catch {
    return false;
  }
};
const newer = (have: string, want: string) => {
  const a = have.split(".").map(Number);
  const b = want.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
};

const required: Line[] = [
  { ok: newer(Bun.version, "1.4.0"), says: `Bun ${Bun.version}`, fix: "install Bun 1.4 or newer from bun.sh" },
  { ok: await canLoad(["hono", "zod"]), says: "packages installed", fix: "run bun install" },
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

const cc = claudeStatus();
const live: Line[] = [
  {
    ok: cc.installed && recentEnough(cc.version),
    says: cc.installed ? `Claude Code ${cc.version ?? "(version unknown)"}` : "Claude Code not found",
    fix: cc.installed ? `run claude update (this course is tested on ${MIN_CLAUDE_CODE} and newer)` : `install it: ${INSTALL}`,
  },
  {
    ok: cc.signedIn === true,
    says: !cc.installed ? "Claude Code sign-in: not checked" : cc.signedIn === null ? "Claude Code sign-in: unknown" : cc.signedIn ? "Claude Code signed in" : "Claude Code not signed in",
    fix: "run claude, then type /login and sign in with your Claude account",
  },
];

for (const l of required) console.log(`  ${l.ok ? "ok  " : "FAIL"}  ${l.says}${l.ok ? "" : `\n        Try next: ${l.fix}`}`);
for (const l of live) console.log(`  ${l.ok ? "ok  " : "--  "}  ${l.says}${l.ok ? "" : `  (to run Claude Code yourself: ${l.fix})`}`);
const need = required.filter((l) => l.ok).length;
if (need < required.length) {
  console.log(`doctor: not ready, ${need} of ${required.length} required checks pass. Fix the FAIL lines and run it again.`);
  process.exit(1);
}
const liveOk = live.every((l) => l.ok);
console.log(
  `doctor: ready, ${need} of ${required.length} required checks pass. Claude Code: ${liveOk ? "ready for live runs" : "not ready yet, so the finished factory replays its recorded runs"}.`,
);
