import { defineConfig } from "@playwright/test";

const PORT = 3100;

// Run with `npm run test:e2e` (builds first). Uses the production build, an
// empty embedded database in .data/e2e and the in-app PayDemo simulator.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // The first request opens the embedded database and runs migrations (a few seconds).
  expect: { timeout: 15_000 },
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    // The customer is in Chicago; the server runs in UTC, like most hosts.
    timezoneId: "America/Chicago",
    locale: "en-US",
    // Locally on Windows, the installed Edge; in CI, Playwright's Chromium.
    channel: process.env.PW_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined),
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PGLITE_DATA_DIR: ".data/e2e", DEMO_DEFAULTS: "1", TZ: "UTC" },
  },
});
