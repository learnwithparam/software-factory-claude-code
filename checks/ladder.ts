// The Claude Code ladder check. ladder.toml maps every L0 to L6 feature to the step that uses it.
// It fails when a level is empty, a step is missing, a step has no check,
// or the step's pages never name the feature. Run it with: bun checks/ladder.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allSteps, ROOT } from "../scripts/structure";

type Feature = { level: string; feature: string; step: string; needle: string };

const LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"];
const PAGES = ["README.md", "GO-FURTHER.md"];

const text = readFileSync(join(ROOT, "ladder.toml"), "utf8");
const features = (Bun.TOML.parse(text) as { feature: Feature[] }).feature;
const steps = allSteps();
const problems: string[] = [];

function pagesOf(stepFolder: string): string {
  return PAGES.map((page) => join(stepFolder, "problem", page))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8").toLowerCase())
    .join("\n");
}

function hasCheck(stepName: string): boolean {
  const files = readdirSync(join(ROOT, "checks"));
  return files.includes(`${stepName}.ts`);
}

for (const level of LEVELS) {
  if (!features.some((entry) => entry.level === level)) problems.push(`${level} has no feature`);
}
for (const entry of features) {
  const step = steps.find((candidate) => candidate.name === entry.step);
  const label = `${entry.level} ${entry.feature}`;
  if (!step) problems.push(`${label}: no step named ${entry.step}`);
  else if (!hasCheck(step.name)) problems.push(`${label}: step ${step.name} has no check`);
  else if (!pagesOf(step.dir).includes(entry.needle.toLowerCase())) {
    problems.push(`${label}: step ${step.name} never names "${entry.needle}"`);
  }
}
for (const step of steps) {
  if (!features.some((entry) => entry.step === step.name)) continue;
  if (!hasCheck(step.name)) problems.push(`step ${step.name} has no check`);
}

if (problems.length > 0) {
  console.log(`The ladder has ${problems.length} gap(s):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `The ladder is whole: ${features.length} features, L0 to L6, each on a step with a check.`,
);
