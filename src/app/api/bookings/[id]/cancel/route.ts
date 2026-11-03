import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";

// Cancel a booking
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, Number(id)));
  } catch {}
  return Response.json({ ok: true });
}
