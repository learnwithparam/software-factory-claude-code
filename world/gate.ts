// bun run gate [app-folder] [--record <file>]
// The one gate: the app's tests must pass. A factory may not finish until this exits 0 on its latest change.
// --record writes what was gated (a hash of src/ and tests/, the git commit if there is one) and the result,
// so a Stop hook can tell a fresh pass from an old one.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const recordAt = args.includes("--record") ? args[args.indexOf("--record") + 1] : undefined;
const appDir = resolve(
  args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--record") ??
    join(import.meta.dir, "app"),
);

export function treeHash(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(relative(dir, p)).update(readFileSync(p));
    }
  };
  walk(join(dir, "src"));
  walk(join(dir, "tests"));
  return h.digest("hex").slice(0, 12);
}

if (import.meta.main) {
  if (!existsSync(join(appDir, "tests"))) {
    console.log(`gate: error, there is no tests/ folder in ${appDir}`);
    process.exit(2);
  }
  const run = Bun.spawnSync(["bun", "test", "./tests"], {
    cwd: appDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const text = run.stdout.toString() + run.stderr.toString();
  const pass = Number(text.match(/(\d+) pass/)?.[1] ?? 0);
  const failed = Number(text.match(/(\d+) fail/)?.[1] ?? 0);
  const git = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
    cwd: appDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const result = {
    command: "bun run gate",
    exit_code: run.exitCode === 0 ? 0 : 1,
    tree: treeHash(appDir),
    sha: git.exitCode === 0 ? git.stdout.toString().trim() : null,
    passed: pass,
    failed,
  };
  if (recordAt) {
    mkdirSync(dirname(resolve(recordAt)), { recursive: true });
    writeFileSync(resolve(recordAt), `${JSON.stringify(result, null, 2)}\n`);
  }
  if (result.exit_code === 0) console.log(`gate: pass, ${pass} tests, tree ${result.tree}`);
  else {
    console.log(
      text
        .split("\n")
        .filter((l) => /\(fail\)|error:|Expected|Received/.test(l))
        .slice(0, 12)
        .join("\n"),
    );
    console.log(`gate: fail, ${failed} of ${pass + failed} tests failed, tree ${result.tree}`);
  }
  process.exit(result.exit_code);
}
