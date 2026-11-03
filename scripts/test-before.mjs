// Runs the CURRENT test suite against the code at tag `vibe-coded` (the "before" version).
// It checks the tag out into .before/ (a git worktree), copies tests/ and
// vitest.config.ts from the working tree, reuses node_modules and runs vitest there.
// The worktree is removed at the end (node_modules link first), unless --keep.
//
//   node scripts/test-before.mjs                 # red is the expected result; exits 0
//   node scripts/test-before.mjs --json out.json # also writes vitest's JSON report
//   node scripts/test-before.mjs --expect-fail   # exit 1 only if every test passes (CI)
//   node scripts/test-before.mjs --strict        # exit with vitest's exit code
//   node scripts/test-before.mjs --keep          # leave .before/ in place (scripts/evidence.mjs)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { addBeforeWorktree, BEFORE, removeBeforeWorktree, ROOT } from "./before-worktree.mjs";

const args = process.argv.slice(2);
const flags = ["--json", "--strict", "--expect-fail", "--keep"];
const jsonOut = args.includes("--json") ? path.resolve(args[args.indexOf("--json") + 1]) : null;
const extra = args.filter((a, i) => !flags.includes(a) && args[i - 1] !== "--json");

let code = 1;
try {
  const sha = addBeforeWorktree();
  const vitest = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
  const reporterArgs = jsonOut
    ? ["--reporter=verbose", "--reporter=json", `--outputFile.json=${jsonOut}`]
    : ["--reporter=verbose"];

  console.log(`Running the current tests against tag vibe-coded (${sha}) in .before/`);
  const run = spawnSync(process.execPath, [vitest, "run", ...reporterArgs, ...extra], {
    cwd: BEFORE,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
  });
  code = run.status ?? 1;
  console.log(
    code === 0
      ? "\nUnexpected: every test passed against the 'before' version."
      : "\nExpected result: the 'before' version fails the finding tests (see above).",
  );
} finally {
  if (!args.includes("--keep")) removeBeforeWorktree();
}

if (args.includes("--strict")) process.exit(code);
if (args.includes("--expect-fail")) process.exit(code === 0 ? 1 : 0);
process.exit(0);
