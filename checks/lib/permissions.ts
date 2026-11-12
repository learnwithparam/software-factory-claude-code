// Match a tool call against permissions rules the way Claude Code orders them:
// deny, then ask, then allow.
// Rule grammar: "Tool" alone matches every call to that tool.
// "Tool(spec)" matches when spec matches:
// for Bash the command, for Read, Edit and Write the file path.
// "*" matches any run of characters, and a trailing ":*" means "this prefix, then anything".
export type Call = {
  tool: string;
  // biome-ignore lint/style/useNamingConvention: Claude Code names this field file_path.
  input: { command?: string; file_path?: string };
};
export type Decision = "deny" | "ask" | "allow" | "none";

type Settings = { permissions?: Partial<Record<"deny" | "ask" | "allow", string[]>> } | null;

const DECISION_ORDER = ["deny", "ask", "allow"] as const;

function patternToRegex(pattern: string): RegExp {
  let wildcardPattern = pattern;
  if (pattern.endsWith(":*")) wildcardPattern = `${pattern.slice(0, -2)}*`;
  const literalPieces = wildcardPattern.split("*");
  const escapedPieces = literalPieces.map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escapedPieces.join(".*")}$`);
}

function startsAtRoot(path: string): boolean {
  return path.startsWith("./") || path.startsWith("/");
}

// A file path as the rule grammar sees it: relative to the project folder, starting with "./".
function pathFromProject(filePath: string, projectDir: string): string {
  const projectPrefix = `${projectDir.replace(/\/$/, "")}/`;
  const path = filePath.replace(projectPrefix, "./");
  if (startsAtRoot(path)) return path;
  return `./${path}`;
}

// A path pattern with no root of its own matches that path in any folder.
function anchoredPathPattern(pattern: string): string {
  if (startsAtRoot(pattern) || pattern.startsWith("~")) return pattern;
  return `./**/${pattern}`;
}

export function ruleMatches(rule: string, call: Call, projectDir = "."): boolean {
  const ruleParts = rule.match(/^([A-Za-z]+)(?:\((.*)\))?$/);
  if (!ruleParts || ruleParts[1] !== call.tool) return false;
  const pattern = ruleParts[2];
  if (pattern === undefined || pattern === "*") return true;
  if (call.tool === "Bash") {
    const command = (call.input.command ?? "").trim();
    return patternToRegex(pattern).test(command);
  }
  const path = pathFromProject(call.input.file_path ?? "", projectDir);
  const pathPattern = anchoredPathPattern(pattern).replace(/\*\*\//g, "*");
  return patternToRegex(pathPattern).test(path);
}

export function decide(settings: unknown, call: Call, projectDir = "."): Decision {
  const permissions = (settings as Settings)?.permissions ?? {};
  for (const kind of DECISION_ORDER) {
    const rules = permissions[kind] ?? [];
    if (rules.some((rule) => ruleMatches(rule, call, projectDir))) return kind;
  }
  return "none";
}
