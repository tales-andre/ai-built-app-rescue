import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, services } from "@/db/schema";
import { isOpen, toAppointmentDate } from "@/lib/booking-time";

// Get bookings for a user
export async function GET(req: Request) {
  const userId = Number(new URL(req.url).searchParams.get("userId"));
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

// Create a booking
export async function POST(req: Request) {
  const body = await req.json();
  const db = await getDb();

  const [service] = await db.select().from(services).where(eq(services.id, body.serviceId));
  const startsAt = toAppointmentDate(body.date, body.time);

  if (!isOpen(startsAt)) {
    return Response.json({ error: "The salon is closed at that time" }, { status: 400 });
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      priceCents: service?.priceCents,
      status: "pending_deposit",
      ...body,
      startsAt,
    })
    .returning();

  return Response.json({ booking }, { status: 201 });
}
