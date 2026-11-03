import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { sessionCookie, verifyPassword } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const db = await getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, String(email ?? "").trim().toLowerCase()));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { "Set-Cookie": sessionCookie(user.id) } },
  );
}
