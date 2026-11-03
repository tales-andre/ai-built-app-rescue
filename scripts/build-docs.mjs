// Builds docs/index.html: one card per finding with the owner-level risk, the
// test results before and after (from docs/evidence/results.json) and the diff
// of the fix commit (from git). Static, no external assets; ready for GitHub Pages.
//
//   node scripts/build-docs.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const REPO_URL = "https://github.com/tales-andre/ai-built-app-rescue";
const MAX_DIFF_LINES = 140;

const { findings, extra } = JSON.parse(readFileSync("report/findings.json", "utf8"));
const results = JSON.parse(readFileSync("docs/evidence/results.json", "utf8"));
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const commits = git("log", "--format=%H%x09%s", "vibe-coded..HEAD")
  .trim()
  .split("\n")
  .map((l) => l.split("\t"));
// "Fix 7:" also picks up its follow-ups ("Fix 7, follow-up: ..."), oldest first.
const findCommits = (prefix) => {
  const base = prefix.replace(/:$/, "");
  return commits.filter(([, s]) => s.startsWith(prefix) || s.startsWith(`${base}, follow-up`)).reverse();
};

function diffFor(sha) {
  const raw = git("show", "--format=", "--unified=2", sha, "--", "src", "next.config.ts", "drizzle/*.sql", ".env.example");
  const lines = raw.split("\n").filter((l) => !l.startsWith("index ") && !l.startsWith("new file mode"));
  const shown = lines.slice(0, MAX_DIFF_LINES);
  const html = shown
    .map((l) => {
      const cls = l.startsWith("diff --git") ? "file" : l.startsWith("@@") ? "hunk" : l.startsWith("+++") || l.startsWith("---") ? "meta" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
      const text = l.startsWith("diff --git") ? l.replace(/^diff --git a\/(\S+) b\/.*$/, "$1") : l;
      return `<span class="${cls}">${esc(text) || " "}</span>`;
    })
    .join("\n");
  const more = lines.length > shown.length ? lines.length - shown.length : 0;
  return { html, more };
}

function testRows(file) {
  const before = results.before.files[file] ?? {};
  const after = results.after.files[file] ?? {};
  return Object.keys(after).map((title) => ({ title, before: before[title], after: after[title] }));
}

const mark = (s) =>
  s === "passed" ? '<span class="ok">pass</span>' : s === "failed" ? '<span class="bad">fail</span>' : '<span class="na">n/a</span>';

function card(f) {
  const fixes = findCommits(f.commit);
  const rows = testRows(f.test);
  const failingBefore = rows.filter((r) => r.before === "failed").length;
  const passingAfter = rows.filter((r) => r.after === "passed").length;
  return `
  <article class="card" id="finding-${f.id}">
    <header>
      <span class="risk risk-${f.risk.toLowerCase()}">${esc(f.risk)}</span>
      <h2>${esc(f.owner_title)}</h2>
    </header>
    <p class="owner"><strong>What could happen to your business:</strong> ${esc(f.what_could_happen)}</p>
    <div class="ba">
      <div class="before"><div class="label">Before</div><div class="big">${failingBefore} of ${rows.length} tests fail</div></div>
      <div class="arrow" aria-hidden="true">&rarr;</div>
      <div class="after"><div class="label">After</div><div class="big">${passingAfter} of ${rows.length} pass</div></div>
    </div>
    <table class="tests">
      <thead><tr><th>Test (<code>${esc(f.test)}</code>)</th><th>Before</th><th>After</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.title)}</td><td>${mark(r.before)}</td><td>${mark(r.after)}</td></tr>`).join("")}</tbody>
    </table>
    <p class="dev"><strong>For your developer:</strong> ${esc(f.dev_title)}. <strong>Fix:</strong> ${esc(f.fix)}</p>
    ${f.action_now && f.action_now !== "None required." ? `<p class="now"><strong>To do outside the code:</strong> ${esc(f.action_now)}</p>` : ""}
    ${fixes
      .map(([sha, subject], i) => {
        const d = diffFor(sha);
        return `<details><summary>${i ? "Follow-up" : "The fix"}: <code>${esc(subject)}</code> (<a href="${REPO_URL}/commit/${sha}">${sha.slice(0, 7)}</a>)</summary>
      <pre class="diff">${d.html}</pre>${d.more ? `<p class="more">${d.more} more lines in the commit.</p>` : ""}</details>`;
      })
      .join("")}
  </article>`;
}

const extraRows = extra
  .map((e) => {
    const rows = testRows(e.test);
    return `<li><strong>${esc(e.title)}</strong> (${esc(e.risk)}). ${esc(e.fix)} Test <code>${esc(e.test)}</code>: ${rows.filter((r) => r.before === "failed").length} of ${rows.length} fail before, ${rows.filter((r) => r.after === "passed").length} of ${rows.length} pass after.</li>`;
  })
  .join("");

const normal = testRows("tests/app.test.ts");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI-built app rescue: before and after</title>
<meta name="description" content="Open-source demo: a fictional salon booking app with mistakes typical of AI-generated code, each fixed in its own commit with a test that fails before and passes after.">
<style>
  :root {
    --bg: #f5f3ef; --card: #ffffff; --ink: #1f1a16; --muted: #6b6159; --line: #e4ddd4;
    --bad: #b42318; --bad-bg: #fdecea; --ok: #1f7a43; --ok-bg: #e6f4ea; --warn: #9a5b00; --warn-bg: #fff4e0;
    --code-bg: #faf8f5;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #171512; --card: #211e1a; --ink: #f1ece6; --muted: #b3a89c; --line: #3a342d;
      --bad: #ff8a80; --bad-bg: #3b1d1a; --ok: #7ad19b; --ok-bg: #18301f; --warn: #f2b45a; --warn-bg: #352712;
      --code-bg: #1b1916;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; }
  .kicker { color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-size: 13px; font-weight: 600; }
  h1 { font-size: clamp(28px, 5vw, 40px); line-height: 1.15; margin: 6px 0 12px; }
  .intro { color: var(--muted); max-width: 760px; }
  .summary { display: flex; flex-wrap: wrap; gap: 12px; margin: 22px 0 28px; }
  .pill { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: 14px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; margin: 0 0 18px; }
  .card header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .card h2 { font-size: 22px; line-height: 1.25; margin: 0; }
  .risk { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-radius: 999px; padding: 4px 10px; }
  .risk-critical { background: var(--bad-bg); color: var(--bad); }
  .risk-high { background: var(--warn-bg); color: var(--warn); }
  .risk-medium { background: var(--code-bg); color: var(--muted); border: 1px solid var(--line); }
  .owner { margin: 12px 0 14px; }
  .ba { display: flex; align-items: stretch; gap: 12px; margin: 0 0 14px; }
  .ba > .before, .ba > .after { flex: 1; border-radius: 10px; padding: 10px 14px; }
  .before { background: var(--bad-bg); color: var(--bad); }
  .after { background: var(--ok-bg); color: var(--ok); }
  .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .big { font-size: 18px; font-weight: 700; }
  .arrow { align-self: center; color: var(--muted); font-size: 22px; }
  table.tests { width: 100%; border-collapse: collapse; font-size: 14px; margin: 0 0 12px; }
  table.tests th, table.tests td { text-align: left; padding: 6px 8px; border-top: 1px solid var(--line); vertical-align: top; }
  table.tests th { color: var(--muted); font-weight: 600; }
  table.tests td:nth-child(2), table.tests td:nth-child(3), table.tests th:nth-child(2), table.tests th:nth-child(3) { width: 64px; text-align: center; }
  .ok, .bad, .na { font-weight: 700; font-size: 12px; text-transform: uppercase; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .na { color: var(--muted); }
  .dev, .now { font-size: 14px; color: var(--muted); margin: 8px 0; }
  .now { color: var(--warn); }
  details { margin-top: 10px; font-size: 14px; }
  summary { cursor: pointer; color: var(--muted); }
  pre.diff { background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; font: 12.5px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
  pre.diff span { display: block; white-space: pre; }
  pre.diff .add { color: var(--ok); background: var(--ok-bg); }
  pre.diff .del { color: var(--bad); background: var(--bad-bg); }
  pre.diff .hunk { color: var(--muted); }
  pre.diff .meta { display: none; }
  pre.diff .file { font-weight: 700; margin-top: 8px; }
  .more { color: var(--muted); font-size: 13px; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .92em; }
  a { color: inherit; }
  footer { color: var(--muted); font-size: 14px; margin-top: 28px; }
  @media (max-width: 600px) {
    .card { padding: 16px; }
    .ba { flex-direction: column; } .arrow { display: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="kicker">Open-source demo &middot; fictional company</div>
  <h1>AI-built booking app, rescued for production</h1>
  <p class="intro">Brightside Salons is a fictional salon chain. Its booking app was written on purpose
  with mistakes that AI-generated code often ships with. Each card is one finding: what it means
  for the business, the tests that prove it (run against the original code and the fixed code),
  and the commit that fixes it.</p>
  <div class="summary">
    <div class="pill">Same tests, two versions: tag <code>vibe-coded</code> and branch <code>main</code></div>
    <div class="pill">Before: ${results.before.failed} failing, ${results.before.passed} passing</div>
    <div class="pill">After: ${results.after.passed} passing, ${results.after.failed} failing</div>
    <div class="pill">Normal use (<code>tests/app.test.ts</code>): ${normal.filter((r) => r.before === "passed").length}/${normal.length} before, ${normal.filter((r) => r.after === "passed").length}/${normal.length} after</div>
  </div>
  ${findings.map(card).join("\n")}
  <article class="card">
    <header><h2>Found while fixing</h2></header>
    <ul>${extraRows}</ul>
  </article>
  <footer>
    Generated by <code>scripts/build-docs.mjs</code> from <code>report/findings.json</code>,
    <code>docs/evidence/results.json</code> and the git history.
    Full report: <a href="${REPO_URL}/blob/main/report/findings.md">report/findings.md</a> &middot;
    Code: <a href="${REPO_URL}">${REPO_URL.replace("https://", "")}</a>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("docs/index.html", html);
console.log(`docs/index.html: ${findings.length} findings`);
