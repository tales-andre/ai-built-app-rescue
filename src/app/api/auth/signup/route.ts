import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, sessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json();
  const db = await getDb();

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, body.email));
  if (existing.length > 0) {
    return Response.json({ error: "Email already registered" }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.password);
  const [user] = await db
    .insert(users)
    .values({ email: body.email, name: body.name, passwordHash })
    .returning();

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { "Set-Cookie": sessionCookie(user.id) } },
  );
}
