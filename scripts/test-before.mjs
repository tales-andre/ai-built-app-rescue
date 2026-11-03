// Runs the CURRENT test suite against the code at tag `vibe-coded` (the "before" version).
// It checks the tag out into .before/ (a git worktree), copies tests/ and
// vitest.config.ts from the working tree, reuses node_modules and runs vitest there.
//
//   node scripts/test-before.mjs                 # red is the expected result; exits 0
//   node scripts/test-before.mjs --json out.json # also writes vitest's JSON report
//   node scripts/test-before.mjs --strict        # exit with vitest's exit code
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BEFORE = path.join(ROOT, ".before");
const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? path.resolve(args[args.indexOf("--json") + 1]) : null;
const strict = args.includes("--strict");
const extra = args.filter((a, i) => !["--json", "--strict"].includes(a) && args[i - 1] !== "--json");

const git = (...a) => execFileSync("git", a, { cwd: ROOT, stdio: "pipe" }).toString();

if (existsSync(BEFORE)) {
  try { git("worktree", "remove", "--force", BEFORE); } catch { rmSync(BEFORE, { recursive: true, force: true }); }
  try { git("worktree", "prune"); } catch {}
}
git("worktree", "add", "--detach", BEFORE, "vibe-coded");

rmSync(path.join(BEFORE, "tests"), { recursive: true, force: true });
cpSync(path.join(ROOT, "tests"), path.join(BEFORE, "tests"), { recursive: true });
cpSync(path.join(ROOT, "vitest.config.ts"), path.join(BEFORE, "vitest.config.ts"));
symlinkSync(path.join(ROOT, "node_modules"), path.join(BEFORE, "node_modules"), "junction");

const vitest = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const reporterArgs = jsonOut
  ? ["--reporter=verbose", "--reporter=json", `--outputFile.json=${jsonOut}`]
  : ["--reporter=verbose"];

console.log(`Running the current tests against tag vibe-coded (${git("rev-parse", "--short", "vibe-coded^{commit}").trim()}) in .before/`);
const run = spawnSync(process.execPath, [vitest, "run", ...reporterArgs, ...extra], {
  cwd: BEFORE,
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
});

const code = run.status ?? 1;
console.log(
  code === 0
    ? "\nUnexpected: every test passed against the 'before' version."
    : "\nExpected result: the 'before' version fails the finding tests (see above).",
);
process.exit(strict ? code : 0);
