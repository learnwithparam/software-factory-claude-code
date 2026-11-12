// write-the-spec: issue 5 as a one-page spec with EARS requirements and a pass list where every line starts false.
import type { Rule } from "../scripts/verify";
import { sections } from "./lib/files";
import { EARS, readSpec, requirementLines, SPEC_SECTIONS } from "./lib/spec";

const spec = (d: string) => readSpec(d, 5);
const reqs = (d: string) => requirementLines(spec(d).spec ?? "");
const passes = (d: string) => {
  const p = spec(d).passes;
  return Array.isArray(p) ? p : null;
};

export default [
  {
    says: "specs/5/SPEC.md has Outcome, Requirements, Must not change, Out of scope and Done when, each with text",
    test: (d) => {
      const s = sections(spec(d).spec ?? "");
      return SPEC_SECTIONS.every((h) => (s.get(h) ?? "").length > 0);
    },
    tryNext: "use these five headings exactly, as ## headings, and write at least one line under each",
  },
  {
    says: "Requirements lists at least three lines numbered R1, R2, R3",
    test: (d) => reqs(d).length >= 3,
    tryNext: "write each requirement as a bullet that starts with its id: - R1. When ...",
  },
  {
    says: "every requirement opens with an EARS keyword and says shall",
    test: (d) => reqs(d).length > 0 && reqs(d).every((r) => EARS.test(r.text) && /\bshall\b/i.test(r.text)),
    tryNext: "start each line with When, While, If, Where, or The system shall, and keep one shall per line",
  },
  {
    says: "the requirements cover class C tools, the induction, and the refusal reason",
    test: (d) => {
      const all = reqs(d).map((r) => r.text.toLowerCase()).join("\n");
      return /class c/.test(all) && /induct/.test(all) && /reason|told|message|explain/.test(all);
    },
    tryNext: "check your lines against world/backlog/answers/5.json: who may borrow, who is refused, and what they are told",
  },
  {
    says: "specs/5/passes.json has exactly one entry per requirement id",
    test: (d) => {
      const p = passes(d);
      const ids = reqs(d).map((r) => r.id).sort();
      return p !== null && ids.length > 0 && JSON.stringify(p.map((e) => e.id).sort()) === JSON.stringify(ids);
    },
    tryNext: "write one object per requirement in passes.json, with id matching R1, R2 and so on",
  },
  {
    says: "every pass entry starts with passes: false",
    test: (d) => (passes(d) ?? []).length > 0 && (passes(d) ?? []).every((e) => e.passes === false),
    tryNext: "set passes to false on every entry; only a run that turns its test green may flip it",
  },
  {
    says: "every pass entry names a test file under tests/ and a test name",
    test: (d) =>
      (passes(d) ?? []).length > 0 &&
      (passes(d) ?? []).every((e) => /^tests\/.+\.test\.ts$/.test(String(e.test_file)) && String(e.test_name ?? "").trim().split(/\s+/).length >= 3),
    tryNext: "add test_file such as tests/items/borrow.test.ts and test_name, the sentence the test will be called",
  },
] satisfies Rule[];
