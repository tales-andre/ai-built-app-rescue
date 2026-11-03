import { getDb } from "@/db";
import { services } from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(services).orderBy(services.id);
  return Response.json({ services: rows });
}
