import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { loginAttempts } from "@/db/schema";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Seconds until this account may try again; 0 if allowed now.
 * Blocked while there are MAX_FAILURES failed attempts in the last 15 minutes
 * with no successful login after them.
 */
async function secondsUntilLoginAllowed(tx: Tx, email: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const recent = await tx
    .select({ succeeded: loginAttempts.succeeded, createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), gt(loginAttempts.createdAt, since)))
    // Insertion order (the id), not the timestamp: concurrent transactions can
    // start at the same instant.
    .orderBy(desc(loginAttempts.id))
    .limit(MAX_FAILURES);
  const lastSuccess = recent.findIndex((a) => a.succeeded);
  const failures = lastSuccess === -1 ? recent : recent.slice(0, lastSuccess);
  if (failures.length < MAX_FAILURES) return 0;
  // Allowed again when the oldest of these failures leaves the window.
  const oldest = Math.min(...failures.map((f) => f.createdAt.getTime()));
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - now.getTime()) / 1000));
}

/**
 * Checks the limit and, if the account may try, records the attempt as failed
 * BEFORE the password is checked. Both steps run in one transaction holding a
 * per-account lock, so requests sent at the same moment are counted one after
 * the other: a burst of parallel guesses cannot all get past the check.
 * The caller marks the attempt as succeeded when the password is right.
 */
export async function reserveLoginAttempt(
  db: Db,
  email: string,
  ip: string | null,
  now = new Date(),
): Promise<{ wait: number; attemptId: number | null }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"login:" + email}::text))`);
    const wait = await secondsUntilLoginAllowed(tx, email, now);
    if (wait > 0) return { wait, attemptId: null };
    const [row] = await tx
      .insert(loginAttempts)
      .values({ email, ip, succeeded: false })
      .returning({ id: loginAttempts.id });
    return { wait: 0, attemptId: row.id };
  });
}

export async function markLoginSucceeded(db: Db, attemptId: number) {
  await db.update(loginAttempts).set({ succeeded: true }).where(eq(loginAttempts.id, attemptId));
}
