// add-a-path-rule: the money rule loads only when Claude Code touches the fee code,
// instead of costing tokens in every session.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { frontmatter, nonEmptyLines } from "./lib/files";
import { appFiles } from "./lib/world";

const MOST_BODY_LINES = 30;
const FEE_FILES = ["src/fees/split.ts", "src/fees/late.ts"];
const MONEY_FOLDERS = ["src/fees/", "tests/fees/"];

function moneyRule(folder: string) {
  return frontmatter(join(folder, ".claude", "rules", "money.md"));
}

// Claude Code takes paths as a YAML list or as one comma-separated string.
function pathPatterns(folder: string): string[] {
  const paths = moneyRule(folder)?.data.paths;
  if (typeof paths === "string") return paths.split(",").map((pattern) => pattern.trim());
  if (Array.isArray(paths)) return paths.map(String);
  return [];
}

function matchesAny(folder: string, file: string): boolean {
  return pathPatterns(folder).some((pattern) => new Bun.Glob(pattern).match(file));
}

function isMoneyFile(file: string): boolean {
  return MONEY_FOLDERS.some((moneyFolder) => file.startsWith(moneyFolder));
}

function bodyText(folder: string): string {
  return moneyRule(folder)?.body ?? "";
}

export default [
  {
    says: ".claude/rules/money.md has frontmatter with a paths list",
    test: (folder) => pathPatterns(folder).length > 0,
    tryNext:
      "ask Claude Code to start money.md with a --- block that holds paths: and a list of globs; " +
      "without paths, the rule loads in every session",
  },
  {
    says: "a paths glob matches src/fees/split.ts and src/fees/late.ts",
    test: (folder) => FEE_FILES.every((file) => matchesAny(folder, file)),
    tryNext:
      "tell Claude Code the app sits at the repo root in the factory, " +
      "so the glob is src/fees/** and not world/app/src/fees/**",
  },
  {
    says: "no glob matches app code outside src/fees/ and tests/fees/",
    test: (folder) => {
      const outside = appFiles().filter((file) => !isMoneyFile(file));
      return pathPatterns(folder).length > 0 && !outside.some((file) => matchesAny(folder, file));
    },
    tryNext:
      "ask Claude Code to narrow the glob: src/** also loads the rule for src/items/borrow.ts, " +
      "where there is no money",
  },
  {
    says: "the rule says amounts are integer cents",
    test: (folder) => /integer cents|whole (number of )?cents/i.test(bodyText(folder)),
    tryNext:
      "ask Claude Code to say in the rule that every amount is in integer cents, never a float",
  },
  {
    says: "the rule names the test file tests/fees/split.test.ts",
    test: (folder) => bodyText(folder).includes("tests/fees/split.test.ts"),
    tryNext:
      "ask Claude Code to name tests/fees/split.test.ts, so it knows which test proves a fix",
  },
  {
    says: `the rule stays short: under ${MOST_BODY_LINES} lines`,
    test: (folder) => {
      const lines = nonEmptyLines(bodyText(folder));
      return lines.length > 0 && lines.length < MOST_BODY_LINES;
    },
    tryNext: "ask Claude Code to keep only the money rules: a few short lines, no background",
  },
] satisfies Rule[];
