import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import { createCheckout } from "@/lib/paydemo";
import { getSessionUserId } from "@/lib/session";

// The browser asks the server to start the deposit checkout. The secret key
// stays on the server; the browser never sees it.
export async function POST(req: Request) {
  const userId = getSessionUserId(req);
  if (!userId) return Response.json({ error: "Please log in" }, { status: 401 });

  const { bookingId } = await req.json();
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, Number(bookingId)), eq(bookings.userId, userId)));
  if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "pending_deposit") {
    return Response.json({ error: "Deposit already paid" }, { status: 409 });
  }

  const result = await createCheckout(booking.id, new URL(req.url).origin);
  return Response.json(result);
}
