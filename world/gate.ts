// bun run gate [app-folder] [--record <file>]
// The one gate: the app's tests must pass.
// A factory may not finish until this exits 0 on its latest change.
// --record writes what was gated (a hash of src/ and tests/, the git commit if there is one)
// and the result, so a Stop hook can tell a fresh pass from an old one.
import { createHash, type Hash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const args = process.argv.slice(2);

function recordPath(): string | undefined {
  if (!args.includes("--record")) return undefined;
  return args[args.indexOf("--record") + 1];
}

// The app folder is the one argument that is not a flag and not the file after --record.
function appFolder(): string {
  const folder = args.find(
    (argument, i) => !argument.startsWith("--") && args[i - 1] !== "--record",
  );
  return resolve(folder ?? join(import.meta.dir, "app"));
}

const recordAt = recordPath();
const appDir = appFolder();

function addFolderToHash(hash: Hash, appRoot: string, folder: string) {
  if (!existsSync(folder)) return;
  // Sorting keeps the hash the same on every machine.
  const entries = readdirSync(folder).sort();
  for (const entry of entries) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) {
      addFolderToHash(hash, appRoot, path);
    } else {
      hash.update(relative(appRoot, path));
      hash.update(readFileSync(path));
    }
  }
}

export function treeHash(dir: string): string {
  const hash = createHash("sha256");
  addFolderToHash(hash, dir, join(dir, "src"));
  addFolderToHash(hash, dir, join(dir, "tests"));
  return hash.digest("hex").slice(0, 12);
}

function runCommand(command: string[], folder: string) {
  return Bun.spawnSync(command, { cwd: folder, stdout: "pipe", stderr: "pipe" });
}

function gitCommit(folder: string): string | null {
  const git = runCommand(["git", "rev-parse", "HEAD"], folder);
  if (git.exitCode !== 0) return null;
  return git.stdout.toString().trim();
}

function countIn(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return Number(match?.[1] ?? 0);
}

// Only the lines that say what failed, so the reader is not buried in passing tests.
function failureLines(text: string): string {
  const lines = text.split("\n");
  const failures = lines.filter((line) => /\(fail\)|error:|Expected|Received/.test(line));
  return failures.slice(0, 12).join("\n");
}

function gate() {
  if (!existsSync(join(appDir, "tests"))) {
    console.log(`gate: error, there is no tests/ folder in ${appDir}`);
    process.exit(2);
  }
  const run = runCommand(["bun", "test", "./tests"], appDir);
  const text = run.stdout.toString() + run.stderr.toString();
  const passed = countIn(text, /(\d+) pass/);
  const failed = countIn(text, /(\d+) fail/);
  let exitCode = 1;
  if (run.exitCode === 0) exitCode = 0;
  const tree = treeHash(appDir);
  const sha = gitCommit(appDir);
  // biome-ignore lint/style/useNamingConvention: the Stop hook and the checks read these keys
  const result = { command: "bun run gate", exit_code: exitCode, tree, sha, passed, failed };
  if (recordAt) {
    mkdirSync(dirname(resolve(recordAt)), { recursive: true });
    writeFileSync(resolve(recordAt), `${JSON.stringify(result, null, 2)}\n`);
  }
  if (exitCode === 0) {
    console.log(`gate: pass, ${passed} tests, tree ${tree}`);
  } else {
    console.log(failureLines(text));
    console.log(`gate: fail, ${failed} of ${passed + failed} tests failed, tree ${tree}`);
  }
  process.exit(exitCode);
}

if (import.meta.main) {
  gate();
}
