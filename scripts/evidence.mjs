// Runs the test suite against the "before" (tag vibe-coded) and "after" (working
// tree) versions and saves the output in docs/evidence/:
//   before.txt / after.txt   vitest output, verbatim (ANSI colors and local paths removed)
//   results.json             per test: passed / failed, before and after
//   e2e-before.txt / e2e-after.txt   with --e2e: Playwright on both production builds
//
//   node scripts/evidence.mjs [--e2e]
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

/** Waits until nothing listens on the port (the previous Next server can take a moment to exit). */
async function waitForFreePort(port, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const busy = await new Promise((resolve) => {
      const sock = net.connect(port, "127.0.0.1");
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => resolve(false));
    });
    if (!busy) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`port ${port} still in use`);
}

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs", "evidence");
const TMP = path.join(ROOT, ".data", "evidence");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const clean = (s) =>
  s
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replaceAll(ROOT + path.sep + ".before", "<repo>")
    .replaceAll(ROOT, "<repo>")
    .replaceAll(ROOT.replaceAll("\\", "/"), "<repo>")
    .replace(/\r\n/g, "\n");

function run(cmd, args, cwd = ROOT, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", ...env },
    shell: process.platform === "win32" && cmd === "npx",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: clean((r.stdout ?? "") + (r.stderr ?? "")) };
}

function condense(jsonFile) {
  const report = JSON.parse(readFileSync(jsonFile, "utf8"));
  const out = {};
  for (const file of report.testResults) {
    const name = path.relative(file.name.includes(".before") ? path.join(ROOT, ".before") : ROOT, file.name).replaceAll("\\", "/");
    out[name] = Object.fromEntries(file.assertionResults.map((a) => [a.title, a.status]));
  }
  return { passed: report.numPassedTests, failed: report.numFailedTests, files: out };
}

const node = process.execPath;
const vitest = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");

console.log("1/2 before (tag vibe-coded)...");
const before = run(node, ["scripts/test-before.mjs", "--json", path.join(TMP, "before.json")]);
writeFileSync(path.join(OUT, "before.txt"), before.out);

console.log("2/2 after (working tree)...");
const after = run(node, [vitest, "run", "--reporter=verbose", "--reporter=json", `--outputFile.json=${path.join(TMP, "after.json")}`]);
writeFileSync(path.join(OUT, "after.txt"), after.out);

const results = { before: condense(path.join(TMP, "before.json")), after: condense(path.join(TMP, "after.json")) };
writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`before: ${results.before.passed} passed, ${results.before.failed} failed`);
console.log(`after:  ${results.after.passed} passed, ${results.after.failed} failed`);

if (process.argv.includes("--e2e")) {
  console.log("e2e after...");
  let r = run("npx", ["next", "build"]);
  if (r.code !== 0) throw new Error("build failed\n" + r.out);
  r = run("npx", ["playwright", "test", "--reporter=list"]);
  writeFileSync(path.join(OUT, "e2e-after.txt"), r.out);

  await waitForFreePort(3100);
  console.log("e2e before...");
  const B = path.join(ROOT, ".before"); // left in place by test-before.mjs
  cpSync(path.join(ROOT, "e2e"), path.join(B, "e2e"), { recursive: true });
  copyFileSync(path.join(ROOT, "playwright.config.ts"), path.join(B, "playwright.config.ts"));
  copyFileSync(path.join(B, ".env.example"), path.join(B, ".env.local")); // the "before" .env, secret included
  rmSync(path.join(B, ".next"), { recursive: true, force: true });
  // Webpack, not Turbopack: Turbopack refuses the node_modules junction outside .before/.
  r = run("npx", ["next", "build", "--webpack"], B);
  if (r.code !== 0) throw new Error("before build failed\n" + r.out);
  // The "before" app ignores PGLITE_DATA_DIR and does not create its data folder.
  mkdirSync(path.join(B, ".data", "pglite"), { recursive: true });
  await waitForFreePort(3100);
  r = run("npx", ["playwright", "test", "--reporter=list"], B);
  writeFileSync(path.join(OUT, "e2e-before.txt"), r.out);
}
