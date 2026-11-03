import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, services } from "@/db/schema";
import { isOpen, toAppointmentDate } from "@/lib/booking-time";
import { getSessionUserId } from "@/lib/session";
import { BookingInput, parseBody } from "@/lib/validation";

// Bookings of the logged-in customer. The user comes from the signed session
// cookie, never from the request: a ?userId= parameter is ignored.
export async function GET(req: Request) {
  const userId = getSessionUserId(req);
  if (!userId) return Response.json({ error: "Please log in" }, { status: 401 });
  const db = await getDb();
  const rows = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      startsAt: bookings.startsAt,
      status: bookings.status,
      priceCents: bookings.priceCents,
      notes: bookings.notes,
      service: services.name,
      depositCents: services.depositCents,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.startsAt));
  return Response.json({ bookings: rows });
}

// Create a booking for the logged-in customer
export async function POST(req: Request) {
  const userId = getSessionUserId(req);
  if (!userId) return Response.json({ error: "Please log in" }, { status: 401 });

  const { data: input, error } = await parseBody(req, BookingInput);
  if (error) return error;

  const db = await getDb();
  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId));
  if (!service) {
    return Response.json({ error: "Invalid input", fieldErrors: { serviceId: ["Unknown service"] } }, { status: 400 });
  }

  const startsAt = toAppointmentDate(input.date, input.time);
  if (!isOpen(startsAt)) {
    return Response.json({ error: "The salon is closed at that time" }, { status: 400 });
  }

  // Every column is set explicitly: price and status come from the server,
  // never from the request body.
  const [booking] = await db
    .insert(bookings)
    .values({
      userId,
      serviceId: service.id,
      startsAt,
      notes: input.notes || null,
      priceCents: service.priceCents,
      status: "pending_deposit",
    })
    .returning();

  return Response.json({ booking }, { status: 201 });
}
