import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import type { Db } from "@/db";
import { loginAttempts } from "@/db/schema";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Seconds until this account may try again; 0 if allowed now.
 * Blocked while there are MAX_FAILURES failed attempts in the last 15 minutes
 * with no successful login after them.
 */
export async function secondsUntilLoginAllowed(db: Db, email: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const recent = await db
    .select({ succeeded: loginAttempts.succeeded, createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), gt(loginAttempts.createdAt, since)))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(MAX_FAILURES);
  const lastSuccess = recent.findIndex((a) => a.succeeded);
  const failures = lastSuccess === -1 ? recent : recent.slice(0, lastSuccess);
  if (failures.length < MAX_FAILURES) return 0;
  // Allowed again when the oldest of these failures leaves the window.
  const oldest = failures[failures.length - 1].createdAt.getTime();
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - now.getTime()) / 1000));
}

export async function recordLoginAttempt(db: Db, email: string, ip: string | null, succeeded: boolean) {
  await db.insert(loginAttempts).values({ email, ip, succeeded });
}
