// Match a tool call against permissions rules the way Claude Code orders them: deny, then ask, then allow.
// Rule grammar: "Tool" alone matches every call to that tool. "Tool(spec)" matches when spec matches:
// for Bash the command, for Read, Edit and Write the file path. "*" matches any run of characters,
// and a trailing ":*" means "this prefix, then anything".
export type Call = { tool: string; input: { command?: string; file_path?: string } };
export type Decision = "deny" | "ask" | "allow" | "none";

const toRegex = (spec: string) => {
  const s = spec.endsWith(":*") ? `${spec.slice(0, -2)}*` : spec;
  return new RegExp(`^${s.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
};

export function ruleMatches(rule: string, call: Call, projectDir = "."): boolean {
  const m = rule.match(/^([A-Za-z]+)(?:\((.*)\))?$/);
  if (!m || m[1] !== call.tool) return false;
  if (m[2] === undefined || m[2] === "*") return true;
  if (call.tool === "Bash") return toRegex(m[2]).test((call.input.command ?? "").trim());
  const path = (call.input.file_path ?? "").replace(`${projectDir.replace(/\/$/, "")}/`, "./");
  const rel = path.startsWith("./") || path.startsWith("/") ? path : `./${path}`;
  const spec = m[2].startsWith("./") || m[2].startsWith("/") || m[2].startsWith("~") ? m[2] : `./**/${m[2]}`;
  return toRegex(spec.replace(/\*\*\//g, "*")).test(rel);
}

export function decide(settings: any, call: Call, projectDir = "."): Decision {
  const p = settings?.permissions ?? {};
  for (const kind of ["deny", "ask", "allow"] as const)
    if ((p[kind] ?? []).some((r: string) => ruleMatches(r, call, projectDir))) return kind;
  return "none";
}
