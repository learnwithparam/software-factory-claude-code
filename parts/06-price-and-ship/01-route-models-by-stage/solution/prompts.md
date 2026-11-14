# How Claude Code got here: route models by stage

Claude Code changed `factory/run.ts` and the stage files. You read its plan and answer the one question it
asked. The files in this folder are what it wrote in a real run with Claude Code.

Start Claude Code in this step's `problem/` folder:

```bash
claude --add-dir ../../../../world --add-dir ../../../../checks
```

Expect: Claude Code opens and waits for your prompt.

## Prompt 1: ask for a plan

Press Shift+Tab until you see plan mode, then type:

```text
Every stage in factory/run.ts runs on the smart role, even triage, which only reads. Plan a change so each stage gets a model by its role. Each file in factory/stages starts with a frontmatter block that names its role: triage fast, spec smart, build smart, review judge. Add a plan stage, factory/stages/plan.md, on the smart role: it reads the spec and writes specs/<issue>/PLAN.md before the build, and it runs only for high-risk issues. Triage decides the risk in a live run; in a dry run, an issue labelled money, privacy or safety is high risk. run.ts reads the role from each stage file and maps it to a Claude Code alias in one place: fast haiku, smart sonnet, judge sonnet. Never a full model id. roles_by_stage records the role of every stage that ran. Show me the plan. Do not write any file yet.
```

## The plan Claude Code showed

```text
Here's the plan. I haven't changed any project files; the plan is saved at `~/.claude/plans/every-stage-in-factory-run-ts-elegant-turing.md`.

**What's already in place:** `run.ts` already has a `Role` type and an `ALIAS` map (`fast: haiku, smart: sonnet, judge: sonnet`), and `roles_by_stage` is already filled from `run.roles`. The problem is that every entry in `STAGES` hard-codes `role: "smart"`.

## 1. Frontmatter on the stage files
Each file in `factory/stages/` starts with `---\nrole: <role>\n---`:
- triage: `fast`
- spec: `smart`
- build: `smart`
- review: `judge`
- plan: `smart`

## 2. New `factory/stages/plan.md` (smart)
- It reads `specs/{{number}}/SPEC.md`, the new tests and the code they touch.
- It writes `specs/{{number}}/PLAN.md` with four sections: Files to change, Steps, Risks, How to check.
- It changes nothing else and runs no shell commands.
- `build.md` gets one new line: "If specs/{{number}}/PLAN.md exists, follow it."

## 3. `factory/run.ts`
- **Roles come from the stage files.** `role` leaves the `Stage` type and the `STAGES` table. A new `readStage(name)` returns `{ role, template }` and throws if the role isn't a key of `ALIAS`. `ALIAS` stays the only place a role becomes an alias, and no full model id appears anywhere.
- **One frontmatter parser.** The parsing in `readIssue` moves into a shared `splitFrontmatter()` helper that both functions use. `fillPrompt` fills in only the body, so the frontmatter never reaches the prompt.
- **`runClaude`** records `run.roles[stage] = role` (dry runs too) and passes `--model ALIAS[role]`.
- **Plan stage.**
  - `StageName` gains `"plan"`.
  - `STAGES.plan` gets tools `Read,Grep,Glob,Write(specs/**)`, 20 turns and $1.50.
  - It runs after the `factory-spec` tag, so `tests_edited` is unaffected. Afterwards it commits a snapshot and checks the budget.
- **Risk.**
  - `Issue` gains `labels`.
  - `triage()` now returns `{ decision, highRisk }`.
  - In a live run, high risk means triage answered `risk === "high"` (the triage schema already asks for it).
  - In a dry run, high risk means the issue has a `money`, `privacy` or `safety` label.
- **Stage order:** triage → spec → plan (high risk only) → build loop → review.
- `roles_by_stage` lists only the stages that ran. This already matches `checks/lib/result.ts`, which includes `plan`.

## 4. `CLAUDE.md`
Update the contract's stage list, add the role-to-alias rule ("never a full model id"), and add the dry-run label rule.

## Expected dry-run results
| issue | labels | roles_by_stage |
|---|---|---|
| 1 | docs | triage fast, spec smart, build smart, review judge |
| 2, 4 | money, privacy | the above plus plan smart |
| 6, 7 | refused, split | triage fast only |

**One thing to decide:** issue 5 (chainsaw induction) is about safety, but it's labelled only `feature`. Under your label rule its dry run skips the plan stage. A live triage would probably rate it high risk. If you want the dry run to plan it too, add a `safety` label to the issue.

## How I'll check it
- Run issues 1, 2 and 6 with `--dry-run --json`. Check `roles_by_stage`, and check that `commands.txt` shows `--model haiku` for triage, `--model sonnet` for the other stages, and a `plan.md` line only for issue 2.
- Run issue 2 with `FACTORY_DRY_GATE=fail`: it should still end as `gate_failed` after 2 rounds.
- Grep `run.ts` and `commands.txt` for `claude-` to confirm there are no full model ids.
- Validate each `result.json` against `checks/lib/result.ts`.
- Run `bun run readable` at the repo root.

Tell me to go ahead and I'll make these changes.
```

## What you check in the plan

- The role lives in the stage file. The alias lives in one map in `run.ts`. No full model id anywhere.
- The plan stage runs after the spec, so the spec's tests are already locked when the plan is written.
- The plan stage may write only under `specs/`.
- Claude Code asks about issue 5. Its labels say `feature`, but it is about chainsaw safety. You do not change
  the library's issues to suit the factory. A live triage can still call it high risk.

## Prompt 2: answer the question, then approve

```text
Go ahead. Leave the issues in world/backlog as they are: they belong to the library, not to the factory. Issue 5 plans in a live run when triage calls it high risk, and that is fine. Make the changes, run your checks, and run bun run readable at the repo root and fix what it reports. Do not start a live run.
```

## What Claude Code reported

```text
Each stage now gets its model from its role, and high-risk issues get a plan stage before the build. Every dry run gives the expected states and roles, all `result.json` files match `checks/lib/result.ts`, and `bun run readable` at the repo root is clean. I made no live run and changed nothing in `world/backlog`.

**What changed**
- **Stage files:** each file in `factory/stages/` now starts with a frontmatter block naming its role: triage fast, spec smart, build smart, review judge.
- **New `plan.md` (smart):** it reads the spec, the new tests and the code they touch, then writes `specs/<issue>/PLAN.md`. Its tools are `Read,Grep,Glob,Write(specs/**)`, with 20 turns and $1.50. `build.md` now says to follow `PLAN.md` if it exists.
- **`factory/run.ts`:**
  - The hard-coded `role` is gone from `STAGES`. A new `readStage()` reads the role from the stage file and stops with an error if it isn't fast, smart or judge.
  - `ALIAS` is still the only place a role becomes an alias. No full model id appears in `run.ts` or in any `commands.txt`.
  - Issue files and stage files now share one frontmatter parser, and the frontmatter is stripped before the prompt is filled in.
  - Triage now returns the risk as well as the decision. In a live run it uses triage's own `risk === "high"`, so issue 5 plans whenever triage calls it high risk. In a dry run it uses the `money`, `privacy` and `safety` labels.
  - The plan stage runs after the `factory-spec` tag, so `tests_edited` is unaffected.
- **`CLAUDE.md`:** documents the plan stage, the role-to-alias rule and the dry-run label rule.

**Dry-run results**
| issue | state | roles_by_stage |
|---|---|---|
| 1, 5 | draft_pr | triage fast, spec smart, build smart, review judge |
| 2, 4 | draft_pr | the same, plus plan smart |
| 3 (`FACTORY_DRY_GATE=fail`) | gate_failed after 2 rounds | triage, spec, build |
| 6 | refused | triage fast |
| 7 | stopped_at_plan | triage fast |

`commands.txt` shows `--model haiku` for triage and `--model sonnet` for every other stage.

**What `readable` reported, and the fix:** Biome's Markdown formatter read a plain `role: fast` line followed by `---` as a heading, and wanted to rewrite it as `## role: fast`. I put blank lines inside the block instead (`---`, blank, `role: fast`, blank, `---`). The YAML still parses the same way.

The dry runs wrote their copies to `runs/` in this folder, which is the default location. I didn't check whether git ignores that folder, so you may want to delete it before you commit.
```

## What you reject

- Stage files that name roles while `run.ts` still sends every call to one model. The
  `wrong/one-model-for-every-stage/` answer maps every role to `sonnet`.
- A plan stage for every issue. The `wrong/plans-every-issue/` answer treats any label as high risk, so even
  the docs issue plans.

```bash
bun run verify route-models-by-stage solution
```

Expect: `Done. All 6 rules pass.`
