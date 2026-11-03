import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React server build; it is a no-op here.
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Servers usually run in UTC. Finding 5 depends on it, so the tests pin it.
    env: {
      TZ: "UTC",
      SESSION_SECRET: "test-session-secret",
      PAYDEMO_SECRET_KEY: "sk_demo_test_only",
      PAYDEMO_WEBHOOK_SECRET: "whsec_test_only",
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
