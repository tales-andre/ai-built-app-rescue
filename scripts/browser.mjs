// Headless browser for the docs scripts. Uses the installed Microsoft Edge on
// Windows, Playwright's Chromium elsewhere (npx playwright install chromium),
// or BROWSER_PATH if set.
import { chromium } from "@playwright/test";

export function launch() {
  const executablePath = process.env.BROWSER_PATH;
  if (executablePath) return chromium.launch({ headless: true, executablePath });
  return chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
}
