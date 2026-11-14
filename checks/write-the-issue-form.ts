// write-the-issue-form: a GitHub issue form that makes every order carry an outcome,
// acceptance lines, what must not change, what is out of scope, and a risk level.
// Read offline; no GitHub needed.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { yaml } from "./lib/files";
import { ranCommand, readSession, userPrompts } from "./lib/session";
import { answers } from "./lib/world";

type Field = {
  type: string;
  id?: string;
  attributes?: { label?: string; options?: unknown[] };
  validations?: { required?: boolean };
};
type Form = { name?: string; description?: string; body?: Field[] };

const TEXTAREAS = ["outcome", "acceptance", "must-not-change", "out-of-scope"];

function formPath(folder: string): string {
  return join(folder, ".github", "ISSUE_TEMPLATE", "change.yml");
}

function form(folder: string): Form | null {
  return yaml<Form>(formPath(folder));
}

function field(folder: string, id: string): Field | undefined {
  return form(folder)?.body?.find((candidate) => candidate.id === id);
}

// A dropdown option is either plain text or an object with a label.
function optionText(option: unknown): string {
  if (typeof option === "string") return option.toLowerCase();
  const label = (option as { label?: string })?.label ?? "";
  return String(label).toLowerCase();
}

function hasNameDescriptionAndBody(folder: string): boolean {
  const issueForm = form(folder);
  const hasBody = Array.isArray(issueForm?.body) && issueForm.body.length > 0;
  return Boolean(issueForm?.name && issueForm?.description && hasBody);
}

function hasRequiredRiskDropdown(folder: string): boolean {
  const risk = field(folder, "risk");
  const options = (risk?.attributes?.options ?? []).map(optionText);
  return (
    risk?.type === "dropdown" &&
    risk.validations?.required === true &&
    ["low", "medium", "high"].every((level) => options.includes(level))
  );
}

function issueFiveFillsRequiredFields(folder: string): boolean {
  const issueFiveAnswers = answers(5);
  const fields = form(folder)?.body ?? [];
  const required = fields.filter((candidate) => candidate.validations?.required && candidate.id);
  const isAnswered = (requiredField: Field) =>
    Boolean(issueFiveAnswers[requiredField.id as string]?.trim());
  return required.length >= 5 && required.every(isAnswered);
}

// A specific prompt names a file, sets a limit, and says when to stop.
const FILE_PATH = /[\w-]+\/[\w./-]+|[\w-]+\.(?:ts|md|yml|json)/;
const LIMIT = /\b(?:do not|don't|never|only|must not)\b/i;
const STOP = /\b(?:stop|then wait|ask me|change nothing)\b/i;
const isSpecific = (prompt: string) =>
  prompt.split(/\s+/).length >= 15 &&
  FILE_PATH.test(prompt) &&
  LIMIT.test(prompt) &&
  STOP.test(prompt);

export default [
  {
    says: ".github/ISSUE_TEMPLATE/change.yml exists and is valid YAML",
    test: (folder) => form(folder) !== null,
    tryNext:
      "start Claude Code in this step's problem folder and ask it to fix the YAML, " +
      "then read its indentation: two spaces, no tabs",
  },
  {
    says: "the form has a name, a description and a body list",
    test: hasNameDescriptionAndBody,
    tryNext:
      "ask Claude Code for top-level keys name: and description:, " +
      "then body: with one entry per field",
  },
  {
    says: "every field in the body has a label",
    test: (folder) => {
      const questions = (form(folder)?.body ?? []).filter((each) => each.type !== "markdown");
      return questions.every((question) => Boolean(question.attributes?.label));
    },
    tryNext: "ask Claude Code to give every field a label: the question a person sees on the form",
  },
  {
    says: "it has textareas with ids outcome, acceptance, must-not-change and out-of-scope",
    test: (folder) => TEXTAREAS.every((id) => field(folder, id)?.type === "textarea"),
    tryNext:
      "ask Claude Code for one textarea per field, with the ids exactly " +
      "outcome, acceptance, must-not-change, out-of-scope",
  },
  {
    says: "those four textareas are required",
    test: (folder) => TEXTAREAS.every((id) => field(folder, id)?.validations?.required === true),
    tryNext:
      "ask Claude Code to add validations: required: true under each of the four; " +
      "GitHub's own samples use false",
  },
  {
    says: "a required dropdown with id risk offers low, medium and high",
    test: hasRequiredRiskDropdown,
    tryNext:
      "ask Claude Code for a dropdown with id risk, options low, medium and high, " +
      "and validations: required: true",
  },
  {
    says: "issue 5's answers fill every required field of your form",
    test: issueFiveFillsRequiredFields,
    tryNext:
      "ask Claude Code to compare the field ids with the keys in world/backlog/answers/5.json; " +
      "every required id needs an answer there",
  },
  {
    says: "your saved session has one specific prompt: a file, a limit and a stop rule",
    test: (folder) => userPrompts(readSession(folder)).some(isSpecific),
    tryNext: "write one prompt that names a file path, says what must not change, and says to stop",
  },
  {
    says: "your saved session shows you ran /clear between two tasks",
    test: (folder) => ranCommand(readSession(folder), "clear"),
    tryNext: "type /clear when you finish one task and start the next, then save the session again",
  },
] satisfies Rule[];
