import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// Both drivers expose the same query API; PGlite's type is used everywhere.
export type Db = PgliteDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __brightsideDb?: Promise<Db> };

export const DEFAULT_SERVICES = [
  { name: "Haircut", durationMin: 45, priceCents: 5500, depositCents: 1500 },
  { name: "Color", durationMin: 120, priceCents: 14000, depositCents: 4000 },
  { name: "Blow-dry", durationMin: 30, priceCents: 3500, depositCents: 1000 },
];

async function seed(db: Db) {
  const existing = await db.select().from(schema.services).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.services).values(DEFAULT_SERVICES);
  }
}

/**
 * Embedded Postgres (PGlite, stored in .data/pglite or PGLITE_DATA_DIR) unless
 * DATABASE_URL points at a real server. No dataDir means in-memory.
 */
export async function createDb(options: { dataDir?: string } = {}): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const db = drizzleNodePg(process.env.DATABASE_URL, { schema }) as unknown as Db;
    await migrateNodePg(db as never, { migrationsFolder: MIGRATIONS });
    await seed(db);
    return db;
  }
  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const client = new PGlite(options.dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await seed(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__brightsideDb) {
    const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
    g.__brightsideDb = createDb({ dataDir });
  }
  return g.__brightsideDb;
}

/** Used by the test suite to give every test file a fresh in-memory database. */
export function setDb(db: Db) {
  g.__brightsideDb = Promise.resolve(db);
}
