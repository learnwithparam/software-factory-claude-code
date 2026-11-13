// bun assignment/check.ts [folder]: test every Done-when line and write result.json.
// The folder defaults to assignment/. The grader runs this same script on your branch.
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import rules, { LITELLM_IMAGE } from "../checks/track-agent-cost";

const folder = resolve(process.argv[2] ?? dirname(import.meta.path));
const lines: { says: string; result: "pass" | "fail" }[] = [];

for (const rule of rules) {
  let holds = false;
  try {
    holds = await rule.test(folder);
  } catch {
    holds = false;
  }
  lines.push({ says: rule.says, result: holds ? "pass" : "fail" });
  console.log(`  ${holds ? "PASS" : "FAIL"}  ${rule.says}`);
}

// biome-ignore lint/style/useNamingConvention: result.json names this key.
const report = { litellm_version: LITELLM_IMAGE.split(":")[1], lines };
writeFileSync(join(folder, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
const failed = lines.filter((line) => line.result === "fail").length;
console.log(failed === 0 ? "Done. All 5 lines pass." : `${failed} line(s) fail.`);
process.exit(failed === 0 ? 0 : 1);
