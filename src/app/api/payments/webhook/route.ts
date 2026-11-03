import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, processedEvents, services } from "@/db/schema";
import { serverSecret } from "@/lib/env";
import { charge } from "@/lib/paydemo";
import { CheckoutCompletedEvent, PayDemoEvent } from "@/lib/validation";
import { verifyPayDemoSignature } from "@/lib/webhook-signature";

// PayDemo calls this after the customer saves a card on the checkout page.
// We then charge the deposit and confirm the booking.
export async function POST(req: Request) {
  // 1. Only PayDemo can call this: check the signature on the raw body.
  const raw = await req.text();
  const secret = serverSecret("PAYDEMO_WEBHOOK_SECRET", "whsec_demo_brightside");
  if (!verifyPayDemoSignature(raw, req.headers.get("paydemo-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 2. A signed event with a missing or malformed field cannot be processed, now
  //    or on a retry: answer 400, not 500 (a 500 means "try again later").
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const base = PayDemoEvent.safeParse(json);
  if (base.success && base.data.type !== "checkout.completed") {
    return Response.json({ received: true, ignored: base.data.type });
  }
  const parsed = CheckoutCompletedEvent.safeParse(json);
  if (!parsed.success) {
    console.error("PayDemo webhook: invalid event", { error: parsed.error.message });
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  const event = parsed.data;

  try {
    const { bookingId, paymentMethod } = event.data;
    const db = await getDb();

    await db.transaction(async (tx) => {
      // 3. Providers deliver "at least once". Record the event id; a repeat is a no-op.
      const fresh = await tx.insert(processedEvents).values({ id: event.id }).onConflictDoNothing().returning();
      if (fresh.length === 0) return;

      // 4. Lock the booking and only charge one that still waits for its deposit
      //    (a second checkout for the same booking, or a cancelled one, is skipped).
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
      if (!booking || booking.status !== "pending_deposit") return;
      const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId));

      // 5. The idempotency key makes the provider return the first charge if this
      //    exact deposit is ever requested again.
      const deposit = await charge({
        amountCents: service.depositCents,
        paymentMethod,
        description: `Deposit for booking ${bookingId}`,
        idempotencyKey: `deposit-booking-${bookingId}`,
      });

      await tx
        .update(bookings)
        .set({ status: "confirmed", depositChargeId: deposit.id })
        .where(eq(bookings.id, bookingId));
    });
  } catch (err) {
    // Answer 500 so PayDemo retries later. Nothing was recorded (the transaction
    // rolled back) and the charge has an idempotency key, so a retry is safe.
    console.error("PayDemo webhook failed", { eventId: event.id, error: String(err) });
    return Response.json({ error: "Processing failed, please retry" }, { status: 500 });
  }

  return Response.json({ received: true });
}
