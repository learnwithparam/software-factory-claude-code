// Start the learner's work: run a command,
// or pipe a recorded Claude Code hook event into their hook.
export type Ran = { code: number; stdout: string; stderr: string };

type RunOptions = { cwd?: string; stdin?: string; env?: Record<string, string> };

export function runCommand(command: string[], options: RunOptions = {}): Ran {
  try {
    const finished = Bun.spawnSync(command, {
      cwd: options.cwd,
      stdin: options.stdin === undefined ? "ignore" : Buffer.from(options.stdin),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ...options.env },
    });
    return {
      code: finished.exitCode ?? 2,
      stdout: finished.stdout.toString(),
      stderr: finished.stderr.toString(),
    };
  } catch (error) {
    // A command that cannot start at all gets the exit code a shell gives for "not found".
    return { code: 127, stdout: "", stderr: (error as Error).message };
  }
}

export type HookVerdict = Ran & {
  json: Record<string, unknown> | null;
  blocked: boolean;
  reason: string;
};

// What a hook may print on stdout to block a call, and why.
type HookOutput = {
  decision?: unknown;
  reason?: unknown;
  hookSpecificOutput?: { permissionDecision?: unknown; permissionDecisionReason?: unknown };
};

function parseHookOutput(stdout: string): HookOutput | null {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Run a hook command the way Claude Code does:
// the event JSON on stdin, through a shell, in the project folder.
// Exit 2 blocks. So does JSON with permissionDecision "deny" (PreToolUse)
// or decision "block" (Stop and others).
export function runHook(
  command: string,
  event: Record<string, unknown>,
  cwd: string,
  env: Record<string, string> = {},
): HookVerdict {
  const ran = runCommand(["sh", "-c", command], {
    cwd,
    stdin: JSON.stringify(event),
    // biome-ignore lint/style/useNamingConvention: Claude Code gives hooks this variable name.
    env: { CLAUDE_PROJECT_DIR: cwd, ...env },
  });
  const output = parseHookOutput(ran.stdout);
  const decision = output?.hookSpecificOutput?.permissionDecision ?? output?.decision;
  const blocked = ran.code === 2 || decision === "deny" || decision === "block";
  let reason: unknown = ran.stderr.trim();
  if (ran.code !== 2) {
    reason = output?.hookSpecificOutput?.permissionDecisionReason ?? output?.reason ?? "";
  }
  const json = output as Record<string, unknown> | null;
  return { ...ran, json, blocked, reason: String(reason) };
}

type HookGroup = { matcher?: string; hooks?: { type?: string; command?: unknown }[] };
type HookSettings = { hooks?: Record<string, HookGroup[] | undefined> } | null;

function matcherAccepts(group: HookGroup, tool?: string): boolean {
  if (!tool || !group.matcher || group.matcher === "*") return true;
  return new RegExp(`^(?:${group.matcher})$`).test(tool);
}

// The hook commands a settings.json registers for one event,
// filtered by the tool name its matcher accepts.
export function hooksFor(settings: unknown, event: string, tool?: string): string[] {
  const groups = (settings as HookSettings)?.hooks?.[event] ?? [];
  const matchingGroups = groups.filter((group) => matcherAccepts(group, tool));
  return matchingGroups.flatMap((group) => {
    const commandHooks = (group.hooks ?? []).filter((hook) => hook.type === "command");
    return commandHooks.map((hook) => String(hook.command));
  });
}
