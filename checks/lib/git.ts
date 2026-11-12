// Read a learner's git repo: branches, what changed, and the gate on a branch.
// Never writes to their tree: a branch is checked out into a throwaway worktree and removed after.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./run";
import { runGate } from "./world";

const git = (repo: string, ...args: string[]) => runCommand(["git", "-C", repo, ...args]);

export const isRepo = (folder: string) => git(folder, "rev-parse", "--git-dir").code === 0;
export const branchExists = (repo: string, branch: string) =>
  git(repo, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`).code === 0;

export function changedFiles(repo: string, base: string, branch: string): string[] {
  const difference = git(repo, "diff", "--name-only", `${base}...${branch}`);
  if (difference.code !== 0) return [];
  return difference.stdout.split("\n").filter(Boolean);
}

// Check out a branch into a temporary worktree and run the gate on the app inside it.
export async function gateOnBranch(repo: string, branch: string, appPath = "world/app") {
  const worktree = join(mkdtempSync(join(tmpdir(), "gate-")), "tree");
  if (git(repo, "worktree", "add", "--detach", worktree, branch).code !== 0) return null;
  try {
    return await runGate(join(worktree, appPath));
  } finally {
    git(repo, "worktree", "remove", "--force", worktree);
  }
}
