// size-the-backlog: a decision for every open issue. Ready means one outcome and at most five named files.
// Work in a protected path is refused. A major upgrade is never ready as one piece.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json } from "./lib/files";
import { appFiles, issues, PROTECTED } from "./lib/world";

type Entry = { issue: number; decision: string; reason?: string; outcome?: string; files?: string[] };
const list = (d: string) => {
  const j = json<Entry[]>(join(d, "factory", "backlog.json"));
  return Array.isArray(j) ? j : null;
};
const get = (d: string, n: number) => list(d)?.find((e) => e.issue === n);
const ready = (d: string) => (list(d) ?? []).filter((e) => e.decision === "ready");
const words = (s?: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

export default [
  {
    says: "factory/backlog.json is a JSON list",
    test: (d) => list(d) !== null,
    tryNext: "write factory/backlog.json as a list: [ { \"issue\": 1, ... }, ... ] and check it with bun -e \"require('./factory/backlog.json')\"",
  },
  {
    says: "every issue in world/backlog has exactly one entry",
    test: (d) => {
      const nums = (list(d) ?? []).map((e) => e.issue).sort((a, b) => a - b);
      return JSON.stringify(nums) === JSON.stringify(issues().map((i) => i.number));
    },
    tryNext: "add one entry for each issue 1 to 7, and no issue twice",
  },
  {
    says: "each decision is ready, split or refuse, with a reason of at least five words",
    test: (d) => (list(d) ?? []).every((e) => ["ready", "split", "refuse"].includes(e.decision) && words(e.reason) >= 5),
    tryNext: "set decision to one of ready, split, refuse, and say why in reason as a full sentence",
  },
  {
    says: "issue 6 is refused and the reason names the protected path",
    test: (d) => get(d, 6)?.decision === "refuse" && PROTECTED.some((p) => (get(d, 6)?.reason ?? "").includes(p.replace(/\/$/, ""))),
    tryNext: "read issue 6 again: which folder would it change, and who reviews that folder? Name it in the reason",
  },
  {
    says: "issue 7 is not ready as one piece",
    test: (d) => Boolean(get(d, 7)) && get(d, 7)?.decision !== "ready",
    tryNext: "a major upgrade with unknown breakage is not one outcome; split it, or refuse it until a person plans it",
  },
  {
    says: "every ready issue names one outcome and one to five files",
    test: (d) => ready(d).length > 0 && ready(d).every((e) => words(e.outcome) >= 5 && Array.isArray(e.files) && e.files.length >= 1 && e.files.length <= 5),
    tryNext: "for each ready issue write outcome (one sentence a person can check) and files (the 1 to 5 paths it will change)",
  },
  {
    says: "every file a ready issue names is in the app, or is a new test under tests/",
    test: (d) => {
      const known = new Set(appFiles());
      return ready(d).every((e) => (e.files ?? []).every((f) => known.has(f) || /^tests\/.+\.test\.ts$/.test(f)));
    },
    tryNext: "use paths as they appear inside world/app, such as src/fees/split.ts, not world/app/src/fees/split.ts",
  },
  {
    says: "no ready issue touches a protected path",
    test: (d) => ready(d).every((e) => (e.files ?? []).every((f) => !PROTECTED.some((p) => f.startsWith(p)))),
    tryNext: "an issue that changes src/auth/ cannot be ready for the factory; refuse it and say who must review it",
  },
] satisfies Rule[];
