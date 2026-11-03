import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

// Who is logged in, according to the signed session cookie (not the browser's storage).
export async function GET(req: Request) {
  const userId = getSessionUserId(req);
  if (!userId) return Response.json({ user: null });
  const db = await getDb();
  const [user] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId));
  return Response.json({ user: user ?? null });
}
