import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { markLoginSucceeded, reserveLoginAttempt } from "@/lib/login-limit";
import { sessionCookie, verifyPassword } from "@/lib/session";
import { LoginInput, parseBody } from "@/lib/validation";

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, LoginInput);
  if (error) return error;
  const email = data.email.trim().toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const db = await getDb();

  // Checked and counted before the password, in one locked step: a paused account
  // gives nothing away, and parallel requests cannot slip past the limit.
  const { wait, attemptId } = await reserveLoginAttempt(db, email, ip);
  if (wait > 0 || attemptId === null) {
    return Response.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.max(wait, 1)) } },
    );
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));
  const ok = !!user && (await verifyPassword(data.password, user.passwordHash));
  if (!ok) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await markLoginSucceeded(db, attemptId);

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { "Set-Cookie": sessionCookie(user.id) } },
  );
}
