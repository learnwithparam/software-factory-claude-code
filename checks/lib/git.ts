// Read a learner's git repo: branches, what changed, and the gate on a branch. Never writes to their tree:
// a branch is checked out into a throwaway worktree and removed after.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sh } from "./run";
import { runGate } from "./world";

const git = (repo: string, ...args: string[]) => sh(["git", "-C", repo, ...args]);

export const isRepo = (dir: string) => git(dir, "rev-parse", "--git-dir").code === 0;
export const branchExists = (repo: string, branch: string) => git(repo, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`).code === 0;

export function changedFiles(repo: string, base: string, branch: string): string[] {
  const r = git(repo, "diff", "--name-only", `${base}...${branch}`);
  return r.code === 0 ? r.stdout.split("\n").filter(Boolean) : [];
}

// Check out a branch into a temporary worktree and run the gate on the app inside it.
export async function gateOnBranch(repo: string, branch: string, appPath = "world/app") {
  const dir = join(mkdtempSync(join(tmpdir(), "gate-")), "tree");
  if (git(repo, "worktree", "add", "--detach", dir, branch).code !== 0) return null;
  try {
    return await runGate(join(dir, appPath));
  } finally {
    git(repo, "worktree", "remove", "--force", dir);
  }
}
