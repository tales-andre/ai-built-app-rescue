// The "before" version (tag vibe-coded) checked out in .before/ as a git worktree,
// with a junction (Windows) or symlink to the main node_modules.
//
// Do not remove .before/ by hand with `git worktree remove --force`: it follows the
// node_modules link and deletes the MAIN node_modules. Use removeBeforeWorktree(),
// which unlinks first (`node scripts/before-worktree.mjs --remove` does that).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = process.cwd();
export const BEFORE = path.join(ROOT, ".before");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, stdio: "pipe" }).toString();

export function removeBeforeWorktree() {
  const link = path.join(BEFORE, "node_modules");
  // Unlink the node_modules junction FIRST, so nothing below can follow it.
  try {
    if (lstatSync(link).isSymbolicLink()) unlinkSync(link);
  } catch {}
  if (existsSync(path.join(BEFORE, "node_modules"))) {
    throw new Error(".before/node_modules is not a link; refusing to remove .before/");
  }
  if (existsSync(BEFORE)) {
    try {
      git("worktree", "remove", "--force", BEFORE);
    } catch {
      rmSync(BEFORE, { recursive: true, force: true });
    }
  }
  try {
    git("worktree", "prune");
  } catch {}
}

/** Fresh worktree of the tag, with the current tests/ and vitest.config.ts copied in. */
export function addBeforeWorktree() {
  removeBeforeWorktree();
  git("worktree", "add", "--detach", BEFORE, "vibe-coded");
  rmSync(path.join(BEFORE, "tests"), { recursive: true, force: true });
  cpSync(path.join(ROOT, "tests"), path.join(BEFORE, "tests"), { recursive: true });
  cpSync(path.join(ROOT, "vitest.config.ts"), path.join(BEFORE, "vitest.config.ts"));
  symlinkSync(path.join(ROOT, "node_modules"), path.join(BEFORE, "node_modules"), "junction");
  return git("rev-parse", "--short", "vibe-coded^{commit}").trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes("--remove")) {
  removeBeforeWorktree();
  console.log("Removed .before/ (node_modules link first).");
}
