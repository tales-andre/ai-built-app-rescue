// Runs the same test suite against a real Postgres server instead of the embedded PGlite.
// Default target: the `db` service from docker-compose.yml. Files run one at a time because
// they share one database (each file empties the tables before every test).
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54330/brightside";
const args = ["vitest", "run", "--no-file-parallelism", ...process.argv.slice(2)];
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
