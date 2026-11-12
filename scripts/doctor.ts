// bun run doctor: is this machine ready? One line per check, then a verdict.
// Required checks decide the exit code. The Claude Code lines come from claude itself
// (`claude --version` and `claude auth status`); the doctor never reads a credentials file.
// Without them the course still replays its recorded runs,
// so they are listed but do not fail the doctor.
import { existsSync } from "node:fs";
import {
  type ClaudeStatus,
  claudeStatus,
  INSTALL,
  MIN_CLAUDE_CODE,
  recentEnough,
} from "../config/claude-code";
import { DB_PATH, seed } from "../world/app/src/db";

type Line = { ok: boolean; says: string; fix: string };

// Packages count as installed when they load.
// Bun can also install them on first import, as CI does.
async function canLoad(packageNames: string[]): Promise<boolean> {
  try {
    for (const packageName of packageNames) await import(packageName);
    return true;
  } catch {
    return false;
  }
}

// True when version `have` is the same as or newer than version `want`, both written as "1.2.3".
function newer(have: string, want: string): boolean {
  const haveParts = have.split(".").map(Number);
  const wantParts = want.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const havePart = haveParts[i] ?? 0;
    const wantPart = wantParts[i] ?? 0;
    if (havePart !== wantPart) return havePart > wantPart;
  }
  return true;
}

// Build the library database if it is missing, so the first run of the doctor also sets it up.
function databaseLine(): Line {
  const hadDatabase = existsSync(DB_PATH);
  if (!hadDatabase) seed();
  return {
    ok: existsSync(DB_PATH),
    says: hadDatabase ? "library database built" : "library database built just now",
    fix: "run bun run world reset",
  };
}

function claudeCodeLine(claude: ClaudeStatus): Line {
  if (!claude.installed) {
    return { ok: false, says: "Claude Code not found", fix: `install it: ${INSTALL}` };
  }
  return {
    ok: recentEnough(claude.version),
    says: `Claude Code ${claude.version ?? "(version unknown)"}`,
    fix: `run claude update (this course is tested on ${MIN_CLAUDE_CODE} and newer)`,
  };
}

function signInText(claude: ClaudeStatus): string {
  if (!claude.installed) return "Claude Code sign-in: not checked";
  if (claude.signedIn === null) return "Claude Code sign-in: unknown";
  if (claude.signedIn) return "Claude Code signed in";
  return "Claude Code not signed in";
}

function signInLine(claude: ClaudeStatus): Line {
  return {
    ok: claude.signedIn === true,
    says: signInText(claude),
    fix: "run claude, then type /login and sign in with your Claude account",
  };
}

function printRequiredLine(line: Line) {
  if (line.ok) console.log(`  ok    ${line.says}`);
  else console.log(`  FAIL  ${line.says}\n        Try next: ${line.fix}`);
}

function printLiveLine(line: Line) {
  if (line.ok) console.log(`  ok    ${line.says}`);
  else console.log(`  --    ${line.says}  (to run Claude Code yourself: ${line.fix})`);
}

const required: Line[] = [
  {
    ok: newer(Bun.version, "1.4.0"),
    says: `Bun ${Bun.version}`,
    fix: "install Bun 1.4 or newer from bun.sh",
  },
  { ok: await canLoad(["hono", "zod"]), says: "packages installed", fix: "run bun install" },
  databaseLine(),
  {
    ok: process.platform !== "win32",
    says: `platform ${process.platform}`,
    fix: "on Windows, work inside WSL2; hooks and paths assume a Unix shell",
  },
];

const claude = claudeStatus();
const live: Line[] = [claudeCodeLine(claude), signInLine(claude)];

for (const line of required) printRequiredLine(line);
for (const line of live) printLiveLine(line);

const passing = required.filter((line) => line.ok).length;
const counted = `${passing} of ${required.length} required checks pass`;
if (passing < required.length) {
  console.log(`doctor: not ready, ${counted}. Fix the FAIL lines and run it again.`);
  process.exit(1);
}
let liveVerdict = "not ready yet, so the finished factory replays its recorded runs";
if (live.every((line) => line.ok)) liveVerdict = "ready for live runs";
console.log(`doctor: ready, ${counted}. Claude Code: ${liveVerdict}.`);
