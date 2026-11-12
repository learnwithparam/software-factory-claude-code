// Start the learner's work: run a command, or pipe a recorded Claude Code hook event into their hook.
export type Ran = { code: number; stdout: string; stderr: string };

export function sh(
  cmd: string[],
  opts: { cwd?: string; stdin?: string; env?: Record<string, string> } = {},
): Ran {
  try {
    const r = Bun.spawnSync(cmd, {
      cwd: opts.cwd,
      stdin: opts.stdin === undefined ? "ignore" : Buffer.from(opts.stdin),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ...opts.env },
    });
    return { code: r.exitCode ?? 2, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
  } catch (e) {
    return { code: 127, stdout: "", stderr: (e as Error).message };
  }
}

export type HookVerdict = Ran & {
  json: Record<string, any> | null;
  blocked: boolean;
  reason: string;
};

// Run a hook command the way Claude Code does: the event JSON on stdin, through a shell, in the project folder.
// Exit 2 blocks. So does JSON with permissionDecision "deny" (PreToolUse) or decision "block" (Stop and others).
export function runHook(
  command: string,
  event: Record<string, unknown>,
  cwd: string,
  env: Record<string, string> = {},
): HookVerdict {
  const r = sh(["sh", "-c", command], {
    cwd,
    stdin: JSON.stringify(event),
    env: { CLAUDE_PROJECT_DIR: cwd, ...env },
  });
  let parsed: Record<string, any> | null = null;
  try {
    parsed = r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null;
  } catch {
    parsed = null;
  }
  const decision = parsed?.hookSpecificOutput?.permissionDecision ?? parsed?.decision;
  const blocked = r.code === 2 || decision === "deny" || decision === "block";
  const reason =
    r.code === 2
      ? r.stderr.trim()
      : (parsed?.hookSpecificOutput?.permissionDecisionReason ?? parsed?.reason ?? "");
  return { ...r, json: parsed, blocked, reason: String(reason) };
}

// The hook commands a settings.json registers for one event, filtered by the tool name its matcher accepts.
export function hooksFor(settings: any, event: string, tool?: string): string[] {
  const groups: any[] = settings?.hooks?.[event] ?? [];
  return groups
    .filter(
      (g) =>
        !tool || !g.matcher || g.matcher === "*" || new RegExp(`^(?:${g.matcher})$`).test(tool),
    )
    .flatMap((g) =>
      (g.hooks ?? []).filter((h: any) => h.type === "command").map((h: any) => String(h.command)),
    );
}
