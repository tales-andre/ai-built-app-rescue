// Screenshots of the findings page and the captioned demo GIF.
//   docs/cards.png        top of docs/index.html (first finding card)
//   docs/demo.gif         test output before -> captions -> test output after
//   docs/cover-crop-*.png crops of the finding card used by docs/cover.html
// The terminal lines in the GIF are copied from docs/evidence/before.txt and
// after.txt (run `node scripts/evidence.mjs` first); only the file path and the
// timing are trimmed from each line.
//
//   node scripts/capture.mjs            (FRAMES_DIR=dir also saves each frame as PNG)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import gifenc from "gifenc";
import { PNG } from "pngjs";
import { launch } from "./browser.mjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const W = 960;
const H = 540;

const before = readFileSync("docs/evidence/before.txt", "utf8").split("\n");
const after = readFileSync("docs/evidence/after.txt", "utf8").split("\n");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Result lines of one test file, trimmed to "× Finding N › test title". */
function lines(output, file, max = 4) {
  return output
    .filter((l) => /^\s+[×✓]/.test(l) && l.includes(file))
    .slice(0, max)
    .map((l) => {
      const ok = l.trim().startsWith("✓");
      const parts = l.trim().slice(2).replace(/\s+\d+ms$/, "").split(" > ");
      const finding = parts[1].split(":")[0];
      return { ok, text: `${ok ? "✓" : "×"} ${finding} › ${parts.slice(2).join(" › ")}` };
    });
}
const summary = (output) => output.filter((l) => /^\s+(Test Files|Tests)\s/.test(l)).map((l) => l.trim());

const css = `
  * { box-sizing: border-box; margin: 0; }
  body { width: ${W}px; height: ${H}px; font-family: "Segoe UI", system-ui, sans-serif; background: #f5f3ef; color: #1f1a16; overflow: hidden; }
  .title { height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 0 64px; }
  .tag { font-size: 18px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .red { color: #b42318; } .green { color: #1f7a43; }
  h1 { font-size: 46px; line-height: 1.15; margin-top: 10px; }
  .sub { font-size: 22px; color: #6b6159; margin-top: 16px; }
  .term { position: absolute; left: 40px; right: 40px; top: 70px; height: 220px; background: #1d1b19; border-radius: 12px; padding: 18px 22px; font: 15.5px/1.6 Consolas, ui-monospace, monospace; color: #e8e2da; }
  .term .head { color: #9b9187; margin-bottom: 8px; }
  .term .bad { color: #ff8a80; } .term .ok { color: #7ad19b; }
  .term div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cap { position: absolute; left: 40px; right: 40px; top: 320px; height: 150px; border-radius: 12px; display: flex; align-items: center; padding: 0 30px; font-size: 32px; font-weight: 700; line-height: 1.2; }
  .cap.bad { background: #fdecea; color: #b42318; } .cap.ok { background: #e6f4ea; color: #1f7a43; }
  .cap small { display: block; font-size: 18px; font-weight: 500; color: #6b6159; margin-top: 6px; }
  .shot { position: absolute; left: 40px; right: 40px; top: 30px; height: 270px; border-radius: 12px; overflow: hidden; border: 1px solid #e4ddd4; background: #fff; }
  .shot img { width: 100%; display: block; }
`;

const term = (head, rows) =>
  `<div class="term"><div class="head">$ ${esc(head)}</div>${rows.map((r) => `<div class="${r.ok ? "ok" : "bad"}">${esc(r.text)}</div>`).join("")}</div>`;
const cap = (kind, text, small = "") => `<div class="cap ${kind}"><div>${esc(text)}${small ? `<small>${esc(small)}</small>` : ""}</div></div>`;
const plain = (rows, ok) => rows.map((t) => ({ ok, text: t }));

const frames = [
  {
    ms: 2600,
    html: `<div class="title"><div class="tag red">Before</div><h1>A salon booking app, with mistakes AI-generated code often ships with</h1><div class="sub">Fictional company, open-source demo. Same tests run on both versions.</div></div>`,
  },
  {
    ms: 3800,
    html: term("npm run test:before", lines(before, "02-other-customers")) + cap("bad", "Anyone could see and cancel other customers' bookings"),
  },
  {
    ms: 3800,
    html: term("npm run test:before", lines(before, "03-payment-webhook")) + cap("bad", "A fake payment message could charge cards; a repeated one charged twice"),
  },
  {
    ms: 3800,
    html: term("npm run test:before", lines(before, "06-input-validation", 3).concat(lines(before, "05-time-zone", 1))) + cap("bad", "Customers could set their own price; 10:00 was saved as 4:00 AM"),
  },
  {
    ms: 3000,
    html: term("npm run test:before", plain(summary(before), false)) + cap("bad", "Before: the finding tests fail", "Normal-use tests pass: the app looked fine"),
  },
  {
    ms: 2600,
    html: `<div class="title"><div class="tag green">After</div><h1>One fix per commit, each with the test that proves it</h1><div class="sub">Branch main: same app, same tests.</div></div>`,
  },
  {
    ms: 3800,
    html: term("npm test", lines(after, "02-other-customers")) + cap("ok", "Other customers' bookings: blocked and tested"),
  },
  {
    ms: 3800,
    html: term("npm test", lines(after, "03-payment-webhook")) + cap("ok", "Payment messages: verified, and each deposit charged once"),
  },
  {
    ms: 3200,
    html: term("npm test", plain(summary(after), true)) + cap("ok", "After: every test passes"),
  },
  {
    ms: 3400,
    html: `<div class="shot"><img src="data:image/png;base64,${readFileSync("docs/screenshots/app-bookings.png").toString("base64")}"></div>` + cap("ok", "And the app still books and takes the deposit", "Playwright, production build: sign up, book, pay deposit"),
  },
];

const browser = await launch();

// 1. Findings page
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve("docs/index.html")).href);
await page.locator("#finding-1").screenshot({ path: "docs/cards.png" });
await page.locator("#finding-2").screenshot({ path: "docs/card-other-customers.png" });

// Crops for docs/cover.html (portfolio cover): the card's title and business risk,
// and its first test rows with the before/after results. No counts or file names.
async function clipOf(selectors, padTop = 12) {
  const boxes = [];
  for (const sel of selectors) boxes.push(await page.locator(sel).boundingBox());
  const x = Math.min(...boxes.map((b) => b.x)) - 16;
  const y = Math.min(...boxes.map((b) => b.y)) - padTop;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + 16;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 12;
  return { x, y, width: right - x, height: bottom - y };
}
await page.screenshot({ path: "docs/cover-crop-risk.png", clip: await clipOf(["#finding-2 header", "#finding-2 .owner"]) });
await page.screenshot({
  path: "docs/cover-crop-tests.png",
  clip: await clipOf(["#finding-2 tbody tr:nth-child(1)", "#finding-2 tbody tr:nth-child(3)"], 0),
});

// 2. GIF
const gif = GIFEncoder();
const shotPage = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const f of frames) {
  await shotPage.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${f.html}</body></html>`, { waitUntil: "load" });
  const buf = await shotPage.screenshot({ type: "png" });
  if (process.env.FRAMES_DIR) writeFileSync(path.join(process.env.FRAMES_DIR, `frame-${frames.indexOf(f)}.png`), buf);
  const png = PNG.sync.read(buf);
  const palette = quantize(png.data, 256);
  gif.writeFrame(applyPalette(png.data, palette), W, H, { palette, delay: f.ms });
}
gif.finish();
writeFileSync("docs/demo.gif", gif.bytes());
await browser.close();
console.log(`docs/cards.png, docs/card-other-customers.png, docs/demo.gif (${frames.length} frames)`);
