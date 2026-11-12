// write-the-issue-form: a GitHub issue form that makes every order carry an outcome, acceptance lines,
// what must not change, what is out of scope, and a risk level. Read offline; no GitHub needed.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { yaml } from "./lib/files";
import { answers } from "./lib/world";

type Field = {
  type: string;
  id?: string;
  attributes?: { label?: string; options?: unknown[] };
  validations?: { required?: boolean };
};
type Form = { name?: string; description?: string; body?: Field[] };

const FORM = (d: string) => join(d, ".github", "ISSUE_TEMPLATE", "change.yml");
const TEXTAREAS = ["outcome", "acceptance", "must-not-change", "out-of-scope"];
const form = (d: string) => yaml<Form>(FORM(d));
const field = (d: string, id: string) => form(d)?.body?.find((f) => f.id === id);
const optionText = (o: unknown) =>
  (typeof o === "string" ? o : String((o as { label?: string })?.label ?? "")).toLowerCase();

export default [
  {
    says: ".github/ISSUE_TEMPLATE/change.yml exists and is valid YAML",
    test: (d) => form(d) !== null,
    tryNext:
      "create the file in this step's problem folder and check the indentation: two spaces, no tabs",
  },
  {
    says: "the form has a name, a description and a body list",
    test: (d) => {
      const f = form(d);
      return Boolean(f?.name && f?.description && Array.isArray(f?.body) && f.body.length > 0);
    },
    tryNext: "add top-level keys name: and description:, then body: with one entry per field",
  },
  {
    says: "every field in the body has a label",
    test: (d) =>
      (form(d)?.body ?? [])
        .filter((f) => f.type !== "markdown")
        .every((f) => Boolean(f.attributes?.label)),
    tryNext: "give every field attributes: label:, the question a person sees on the form",
  },
  {
    says: "it has textareas with ids outcome, acceptance, must-not-change and out-of-scope",
    test: (d) => TEXTAREAS.every((id) => field(d, id)?.type === "textarea"),
    tryNext:
      "add one type: textarea per field, and set id: to exactly outcome, acceptance, must-not-change, out-of-scope",
  },
  {
    says: "those four textareas are required",
    test: (d) => TEXTAREAS.every((id) => field(d, id)?.validations?.required === true),
    tryNext:
      "add validations: required: true under each of the four; GitHub's own samples use false",
  },
  {
    says: "a required dropdown with id risk offers low, medium and high",
    test: (d) => {
      const f = field(d, "risk");
      const opts = (f?.attributes?.options ?? []).map(optionText);
      return (
        f?.type === "dropdown" &&
        f.validations?.required === true &&
        ["low", "medium", "high"].every((o) => opts.includes(o))
      );
    },
    tryNext:
      "add type: dropdown with id: risk, options: [low, medium, high], and validations: required: true",
  },
  {
    says: "issue 5's answers fill every required field of your form",
    test: (d) => {
      const a = answers(5);
      const required = (form(d)?.body ?? []).filter((f) => f.validations?.required && f.id);
      return required.length >= 5 && required.every((f) => Boolean(a[f.id as string]?.trim()));
    },
    tryNext:
      "compare your field ids with the keys in world/backlog/answers/5.json; every required id needs an answer there",
  },
] satisfies Rule[];
