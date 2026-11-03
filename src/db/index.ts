import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
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

/** Embedded Postgres (PGlite) unless DATABASE_URL points at a real server. */
export async function createDb(options: { dataDir?: string } = {}): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const db = drizzleNodePg(process.env.DATABASE_URL, { schema }) as unknown as Db;
    await migrateNodePg(db as never, { migrationsFolder: MIGRATIONS });
    await seed(db);
    return db;
  }
  const client = new PGlite(options.dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await seed(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__brightsideDb) {
    g.__brightsideDb = createDb({ dataDir: path.join(process.cwd(), ".data", "pglite") });
  }
  return g.__brightsideDb;
}

/** Used by the test suite to give every test file a fresh in-memory database. */
export function setDb(db: Db) {
  g.__brightsideDb = Promise.resolve(db);
}
