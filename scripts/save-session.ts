// bun run save-session <folder>: copy your newest Claude Code session for this repo
// into <folder>/evidence/session.jsonl, so a step check can read what you really did.
// Run it from the folder where you started claude.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Give the folder to save into, for example: bun run save-session my-work");
  process.exit(2);
}
// The shell tells us where you ran the command, even when bun starts in the repo root.
const here = process.env.PWD ?? process.cwd();
const projectKey = here.replace(/[^A-Za-z0-9]/g, "-");
const sessions = join(homedir(), ".claude", "projects", projectKey);
if (!existsSync(sessions)) {
  console.error(`No Claude Code sessions found for ${here}. Start claude here first.`);
  process.exit(1);
}
const files = readdirSync(sessions).filter((name) => name.endsWith(".jsonl"));
const newest = files
  .map((name) => ({ name, time: statSync(join(sessions, name)).mtimeMs }))
  .sort((a, b) => b.time - a.time)[0];
if (!newest) {
  console.error("That folder has no saved sessions yet.");
  process.exit(1);
}
const evidence = join(resolve(here, target), "evidence");
mkdirSync(evidence, { recursive: true });
copyFileSync(join(sessions, newest.name), join(evidence, "session.jsonl"));
console.log(`Saved your newest session to ${join(evidence, "session.jsonl")}`);
