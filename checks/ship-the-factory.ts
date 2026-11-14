// ship-the-factory: the factory runs the whole backlog, live, and the scorecard says how it did.
// Every claim in a result file is checked against what Claude Code printed: the cost against the
// transcripts. Then notes/retro.md says what you learned.
// This check is the scorecard: bun run verify ship-the-factory prints one line per target.
import { join } from "node:path";
import { liveRun } from "../parts/06-price-and-ship/factory-checks";
import type { Rule } from "../scripts/verify";
import { read, sections } from "./lib/files";
import type { Result } from "./lib/result";

const ISSUES = [1, 2, 3, 4, 5, 6, 7];
const FIXABLE_ISSUES = [1, 2, 3, 4, 5];
const TOTAL_CAP_USD = 5;
const RETRO_HEADINGS = ["a gate that fired", "what it cost", "what i change next"];

function resultFor(folder: string, issue: number): Result | null {
  return liveRun(folder, issue).result;
}

function everyIssueRanLive(folder: string): boolean {
  return ISSUES.every((issue) => {
    const live = liveRun(folder, issue);
    return live.result !== null && live.costMatches && live.result.cost_usd > 0;
  });
}

function reachedDraft(result: Result | null): boolean {
  const green = result?.state === "draft_pr" && result.gate?.exit_code === 0;
  return green && result?.review?.verdict === "pass";
}

function threeIssuesReachDraft(folder: string): boolean {
  const drafts = FIXABLE_ISSUES.filter((issue) => reachedDraft(resultFor(folder, issue)));
  return drafts.length >= 3;
}

function noTestEdited(folder: string): boolean {
  const results = ISSUES.map((issue) => resultFor(folder, issue));
  return results.every((result) => result !== null && result.tests_edited.length === 0);
}

function stopsWhereItShould(folder: string): boolean {
  const refused = resultFor(folder, 6)?.state === "refused";
  return refused && resultFor(folder, 7)?.state === "stopped_at_plan";
}

function plansOnlyHighRisk(folder: string): boolean {
  const planned = (issue: number) => resultFor(folder, issue)?.roles_by_stage.plan === "smart";
  return planned(2) && planned(4) && !planned(1);
}

function totalCost(folder: string): number {
  const results = ISSUES.map((issue) => resultFor(folder, issue));
  const costs = results.map((result) => result?.cost_usd ?? Number.POSITIVE_INFINITY);
  return costs.reduce((sum, cost) => sum + cost, 0);
}

function retroSection(folder: string, heading: string): string {
  const retro = read(join(folder, "notes", "retro.md")) ?? "";
  return sections(retro).get(heading) ?? "";
}

function retroIsWritten(folder: string): boolean {
  return RETRO_HEADINGS.every((heading) => {
    const words = retroSection(folder, heading).split(/\s+/).filter(Boolean);
    return words.length >= 8;
  });
}

function retroNamesTheCost(folder: string): boolean {
  return /\$\d/.test(retroSection(folder, "what it cost"));
}

// OpenTelemetry (OTel) is the open standard Claude Code uses to report cost and tokens.
function telemetryIsOn(folder: string): boolean {
  const lines = (read(join(folder, "factory", "ci.env")) ?? "").split("\n");
  const settings = new Map<string, string>();
  for (const line of lines) {
    const found = line.match(/^([A-Z_]+)=(.*)$/);
    if (found) settings.set(found[1], found[2].trim());
  }
  const switchedOn = settings.get("CLAUDE_CODE_ENABLE_TELEMETRY") === "1";
  const exporter = settings.get("OTEL_METRICS_EXPORTER") ?? "";
  const secretInside = [...settings.keys()].some((name) => /HEADERS|TOKEN|KEY/.test(name));
  return switchedOn && ["console", "otlp"].includes(exporter) && !secretInside;
}

function dollarAmounts(text: string): number[] {
  return [...text.matchAll(/\$(\d+(?:\.\d+)?)/g)].map((found) => Number(found[1]));
}

// The "before" figure must be the real total of the seven runs. The "after" figure must differ,
// and the section must name the setting that changed, so a made-up pair cannot pass.
function beforeAndAfterAreHonest(folder: string): boolean {
  const section = retroSection(folder, "before and after");
  const amounts = dollarAmounts(section);
  const total = totalCost(folder);
  const beforeIsReal = amounts.some((amount) => Math.abs(amount - total) < 0.01);
  const afterDiffers = amounts.some((amount) => Math.abs(amount - total) >= 0.01 && amount > 0);
  const namesChange = /(--max-|max-turns|budget|model|prompt|setting|role)/i.test(section);
  return Number.isFinite(total) && beforeIsReal && afterDiffers && namesChange;
}

export default [
  {
    says: "issues 1 to 7 each have a live run, and each cost matches its transcripts",
    test: everyIssueRanLive,
    tryNext:
      "run bun run factory <issue> --json for each issue 1 to 7, without --dry-run; " +
      "a run with no result.json was stopped before it ended",
  },
  {
    says: "at least 3 of issues 1 to 5 reached draft_pr, gate green and review passing",
    test: threeIssuesReachDraft,
    tryNext:
      "read runs/<issue>/result.json for the issues that stopped; the state and the review " +
      "findings say which stage to fix",
  },
  {
    says: "no run edited a test file in the build stage",
    test: noTestEdited,
    tryNext:
      "a non-empty tests_edited means the builder changed the test, not the code; " +
      "check that the test-lock hook is in factory/app/.claude/settings.json",
  },
  {
    says: "issue 6 was refused and issue 7 stopped at the plan",
    test: stopsWhereItShould,
    tryNext: "read the triage transcript of issue 6 or 7 to see why it went on; tighten triage.md",
  },
  {
    says: "the high-risk issues 2 and 4 planned on the smart role, and issue 1 did not plan",
    test: plansOnlyHighRisk,
    tryNext: "read roles_by_stage in runs/2/result.json; triage must call money and privacy high",
  },
  {
    says: "the seven runs cost under 5 USD together",
    test: (folder) => totalCost(folder) < TOTAL_CAP_USD,
    tryNext:
      "add up cost_usd in runs/*/result.json; find the stage that spent the most " +
      "and ask Claude Code why",
  },
  {
    says: "notes/retro.md answers its three headings, and What it cost names a dollar amount",
    test: (folder) => retroIsWritten(folder) && retroNamesTheCost(folder),
    tryNext:
      "write a few sentences under each heading: a gate that fired, what it cost (with $), " +
      "and what you change next",
  },
  {
    says: "factory/ci.env turns on telemetry (OTel) with no secret in it",
    test: telemetryIsOn,
    tryNext:
      "ask Claude Code to add CLAUDE_CODE_ENABLE_TELEMETRY=1 and OTEL_METRICS_EXPORTER=console " +
      "to factory/ci.env, and to keep any header token out of the file",
  },
  {
    says: "the retro names one changed setting and two costs, the first the real total",
    test: beforeAndAfterAreHonest,
    tryNext:
      "change one setting, run the seven issues again, then write the old total, the new total " +
      "and the setting you changed under Before and after; the old total must match the runs",
  },
] satisfies Rule[];
