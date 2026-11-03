import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

// Cancel one of the logged-in customer's bookings
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(req);
  if (!userId) return Response.json({ error: "Please log in" }, { status: 401 });
  const { id } = await params;
  // No try/catch: if the update fails, the customer gets an error (500), not a
  // "cancelled" message for a booking that is still active.
  const db = await getDb();
  // Only matches a booking that belongs to this customer. Someone else's
  // booking gets the same 404 as one that does not exist.
  const updated = await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, Number(id)), eq(bookings.userId, userId)))
    .returning({ id: bookings.id });
  if (updated.length === 0) return Response.json({ error: "Booking not found" }, { status: 404 });
  return Response.json({ ok: true });
}
