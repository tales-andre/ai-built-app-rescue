// report/findings.md -> report/findings.pdf (Markdown to HTML with marked, printed by a headless browser).
//   node scripts/report-pdf.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";
import { launch } from "./browser.mjs";

const body = marked.parse(readFileSync("report/findings.md", "utf8"));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Code review: Brightside Salons booking app</title>
<style>
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; color: #1f1a16; }
  h1 { font-size: 20pt; margin: 0 0 6pt; } h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #e4ddd4; padding-bottom: 3pt; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 6pt 0; }
  th, td { border: 1px solid #e4ddd4; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f5f3ef; }
  code { font-family: Consolas, ui-monospace, monospace; font-size: 9pt; background: #f5f3ef; padding: 0 2pt; border-radius: 2pt; }
  pre { background: #f5f3ef; padding: 8pt; border-radius: 4pt; font-size: 9pt; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  em { color: #6b6159; } a { color: #1f1a16; }
  li { margin: 2pt 0; }
</style></head><body>${body}</body></html>`;

writeFileSync(".data/findings-print.html", html);
const browser = await launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: "report/findings.pdf",
  format: "Letter",
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="font-size:8px;color:#6b6159;width:100%;text-align:center;">Sample report, open-source demo, fictional company &middot; page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
});
await browser.close();
console.log("report/findings.pdf written");
