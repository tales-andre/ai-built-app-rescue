import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { hashPassword, sessionCookie } from "@/lib/session";
import { parseBody, SignupInput } from "@/lib/validation";

const taken = () => Response.json({ error: "Email already registered" }, { status: 409 });

export async function POST(req: Request) {
  const { data: body, error } = await parseBody(req, SignupInput);
  if (error) return error;
  const email = body.email.trim().toLowerCase();
  const db = await getDb();

  // Friendly early answer; the unique index below is what actually guarantees it.
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) return taken();

  const passwordHash = await hashPassword(body.password);
  let user;
  try {
    [user] = await db.insert(users).values({ email, name: body.name, passwordHash }).returning();
  } catch (err) {
    // Two sign-ups raced past the check above: the second insert hits the index.
    if (isUniqueViolation(err)) return taken();
    throw err;
  }

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 201, headers: { "Set-Cookie": sessionCookie(user.id) } },
  );
}
