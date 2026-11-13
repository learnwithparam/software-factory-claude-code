// The factory contract: what `bun run factory <issue> --json` prints
// and saves to runs/<issue>/result.json.
// Any design passes if it writes this shape. Roles, not model ids, are recorded per stage.
import { z } from "zod";

export const STATES = [
  "draft_pr",
  "refused",
  "stopped_at_plan",
  "stopped_budget",
  "gate_failed",
] as const;
export const STAGES = ["triage", "spec", "plan", "build", "review"] as const;

const ROLES = ["fast", "smart", "judge", "none"] as const;

const ReviewFinding = z.object({
  file: z.string(),
  line: z.number().int(),
  evidence: z.string(),
});

const BlockedToolCall = z.object({
  stage: z.string(),
  tool: z.string(),
  file: z.string(),
  reason: z.string(),
});

// biome-ignore-start lint/style/useNamingConvention: the result.json contract uses snake_case.
const GateRecord = z.object({
  command: z.string(),
  exit_code: z.number().int(),
  tree: z.string(),
  rounds: z.number().int().min(0),
});

// One entry per claude -p run: its stream-json transcript (relative to the run folder),
// its turns and its cost.
const ClaudeRun = z.object({
  stage: z.string(),
  transcript: z.string(),
  turns: z.number().int().min(0),
  cost_usd: z.number().min(0),
});

export const Result = z.object({
  issue: z.number().int().min(1),
  state: z.enum(STATES),
  branch: z.string().nullable(),
  worktree: z.string().nullable(),
  pr_url: z.string().nullable(),
  gate: GateRecord.nullable(),
  review: z
    .object({ verdict: z.enum(["pass", "block"]), findings: z.array(ReviewFinding) })
    .nullable(),
  tests_edited: z.array(z.string()),
  blocked_by_hooks: z.array(BlockedToolCall),
  roles_by_stage: z.record(z.string(), z.enum(ROLES)),
  cost_usd: z.number().min(0),
  replayed: z.boolean(),
  claude_runs: z.array(ClaudeRun).optional(),
});
// biome-ignore-end lint/style/useNamingConvention: the contract ends here.
export type Result = z.infer<typeof Result>;

export function parseResult(
  raw: unknown,
): { ok: true; result: Result } | { ok: false; why: string } {
  const parsed = Result.safeParse(raw);
  if (parsed.success) return { ok: true, result: parsed.data };
  const problems = parsed.error.issues.map((problem) => {
    const where = problem.path.join(".");
    return `${where}: ${problem.message}`;
  });
  return { ok: false, why: problems.join("; ") };
}
