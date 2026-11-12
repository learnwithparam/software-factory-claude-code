// The factory contract: what `bun run factory <issue> --json` prints and saves to runs/<issue>/result.json.
// Any design passes if it writes this shape. Roles, not model ids, are recorded per stage.
import { z } from "zod";

export const STATES = ["draft_pr", "refused", "stopped_at_plan", "stopped_budget", "gate_failed"] as const;
export const STAGES = ["triage", "spec", "plan", "build", "review"] as const;

export const Result = z.object({
  issue: z.number().int().min(1),
  state: z.enum(STATES),
  branch: z.string().nullable(),
  worktree: z.string().nullable(),
  pr_url: z.string().nullable(),
  gate: z.object({ command: z.string(), exit_code: z.number().int(), tree: z.string(), rounds: z.number().int().min(0) }).nullable(),
  review: z
    .object({
      verdict: z.enum(["pass", "block"]),
      findings: z.array(z.object({ file: z.string(), line: z.number().int(), evidence: z.string() })),
    })
    .nullable(),
  tests_edited: z.array(z.string()),
  blocked_by_hooks: z.array(z.object({ stage: z.string(), tool: z.string(), file: z.string(), reason: z.string() })),
  roles_by_stage: z.record(z.string(), z.enum(["fast", "smart", "judge", "none"])),
  cost_usd: z.number().min(0),
  replayed: z.boolean(),
});
export type Result = z.infer<typeof Result>;

export function parseResult(raw: unknown): { ok: true; result: Result } | { ok: false; why: string } {
  const r = Result.safeParse(raw);
  return r.success ? { ok: true, result: r.data } : { ok: false, why: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}
