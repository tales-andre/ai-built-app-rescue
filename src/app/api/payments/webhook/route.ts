import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, services } from "@/db/schema";
import { charge } from "@/lib/paydemo";

// PayDemo calls this after the customer saves a card on the checkout page.
// We then charge the deposit and confirm the booking.
export async function POST(req: Request) {
  try {
    const event = await req.json();

    if (event.type === "checkout.completed") {
      const { bookingId, paymentMethod } = event.data;
      const db = await getDb();
      const [row] = await db
        .select({ booking: bookings, depositCents: services.depositCents })
        .from(bookings)
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .where(eq(bookings.id, bookingId));

      const deposit = await charge({
        amountCents: row.depositCents,
        paymentMethod,
        description: `Deposit for booking ${bookingId}`,
      });

      await db
        .update(bookings)
        .set({ status: "confirmed", depositChargeId: deposit.id })
        .where(eq(bookings.id, bookingId));
    }
  } catch (err) {
    // ignore
  }

  return Response.json({ received: true });
}
