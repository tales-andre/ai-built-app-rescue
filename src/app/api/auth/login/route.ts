import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { sessionCookie, verifyPassword } from "@/lib/session";
import { LoginInput, parseBody } from "@/lib/validation";

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, LoginInput);
  if (error) return error;
  const { email, password } = data;
  const db = await getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { "Set-Cookie": sessionCookie(user.id) } },
  );
}
