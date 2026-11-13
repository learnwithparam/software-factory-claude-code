// How this course runs Claude Code. The learner works in the real Claude Code
// (the claude CLI, Claude Code in an editor, or Claude Desktop's Code tab),
// signed in with their own Claude account.
// Nothing in this repo calls the model API, and no step asks for an API key.
//
// The finished factory runs `claude -p` once per stage. Stages ask for a role,
// and the role maps to a Claude Code model alias here
// (the same aliases agent frontmatter and `--model` take).
// No full model id appears anywhere in the repo.

export type Role = "fast" | "smart" | "judge";
export const ROLES: Role[] = ["fast", "smart", "judge"];
export const ALIAS: Record<Role, string> = { fast: "haiku", smart: "sonnet", judge: "sonnet" };

// The oldest Claude Code this course is tested on:
// the npm "stable" tag of @anthropic-ai/claude-code,
// read from the registry when the course was built (2.1.311, published 2026-10-26).
export const MIN_CLAUDE_CODE = "2.1.311";

// The official install command for macOS, Linux and WSL (code.claude.com/docs/en/setup).
export const INSTALL = "curl -fsSL https://claude.ai/install.sh | bash";

// Flags every headless stage passes.
// Read from `claude --help` and code.claude.com/docs/en/headless:
// - stream-json needs --verbose in print mode,
//   and its last line is the result with total_cost_usd.
// - Since 2.1.302 a bare -p starts in Manual mode and denies anything that would prompt,
//   so the factory names a mode (dontAsk: deny whatever the allow list does not cover)
//   and the tools each stage may use.
// - --setting-sources project,local loads the factory's own .claude/settings.json
//   and not the hooks in your ~/.claude, so every machine runs the same gates.
// - Never --bare: it skips the project's hooks, and the hooks are the gates.
export const HEADLESS = [
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-hook-events",
  "--permission-mode",
  "dontAsk",
  "--setting-sources",
  "project,local",
  "--no-session-persistence",
];

export type ClaudeStatus = {
  installed: boolean;
  version: string | null;
  signedIn: boolean | null;
  how: string;
};

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

export const recentEnough = (version: string | null) =>
  Boolean(version && newer(version, MIN_CLAUDE_CODE));

// Null means claude could not start at all, so it is not installed.
function runClaude(args: string[]): { code: number | null; output: string } | null {
  try {
    const finished = Bun.spawnSync(["claude", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    return { code: finished.exitCode, output: finished.stdout.toString().trim() };
  } catch {
    return null;
  }
}

// Ask Claude Code itself: `claude --version`, then `claude auth status` (JSON with loggedIn).
// It never reads a credentials file.
export function claudeStatus(): ClaudeStatus {
  const versionRun = runClaude(["--version"]);
  if (versionRun?.code !== 0) {
    return { installed: false, version: null, signedIn: null, how: "" };
  }
  const version = versionRun.output.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  const authRun = runClaude(["auth", "status"]);
  try {
    const auth = JSON.parse(authRun?.output ?? "");
    return {
      installed: true,
      version,
      signedIn: Boolean(auth.loggedIn),
      how: String(auth.authMethod ?? ""),
    };
  } catch {
    return { installed: true, version, signedIn: null, how: "" };
  }
}

// A live run needs a signed-in claude and a person's machine.
// CI and FACTORY_REPLAY=1 always replay.
export function canRunLive(): { live: boolean; why: string } {
  if (process.env.CI) return { live: false, why: "this is CI" };
  if (process.env.FACTORY_REPLAY === "1") return { live: false, why: "FACTORY_REPLAY=1 is set" };
  const status = claudeStatus();
  if (!status.installed) return { live: false, why: "claude is not installed here" };
  if (status.signedIn === false) {
    return { live: false, why: "claude is not signed in (run claude, then /login)" };
  }
  if (!recentEnough(status.version)) {
    return { live: false, why: `claude ${status.version} is older than ${MIN_CLAUDE_CODE}` };
  }
  return { live: true, why: "" };
}
