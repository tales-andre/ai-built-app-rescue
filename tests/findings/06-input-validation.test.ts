// Finding 6: the booking API saves whatever the browser sends. A customer can
// set their own price, and malformed input crashes the request.
import { beforeEach, describe, expect, it } from "vitest";
import { createBookingRaw, freshApp, getBooking, signup, type TestUser } from "../helpers/app";

let frank: TestUser;

beforeEach(async () => {
  await freshApp();
  frank = await signup("frank@example.com", "Frank");
});

describe("Finding 6: the booking form trusts whatever the browser sends", () => {
  it("a customer cannot book a $55 haircut for $0 or mark it as already confirmed", async () => {
    const res = await createBookingRaw(frank, {
      serviceId: 1,
      date: "2026-11-10",
      time: "10:00",
      priceCents: 0,
      status: "confirmed",
    });
    expect(res.status).toBe(201);
    const { booking } = await res.json();
    const saved = await getBooking(booking.id);
    expect(saved.priceCents).toBe(5500);
    expect(saved.status).toBe("pending_deposit");
  });

  it("a missing service gets a clear 400 with the field name, not a 500", async () => {
    const res = await createBookingRaw(frank, { date: "2026-11-10", time: "10:00" });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("serviceId");
  });

  it("a malformed date gets a 400 that names the field", async () => {
    const res = await createBookingRaw(frank, { serviceId: 1, date: "next tuesday", time: "10am" });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("date");
  });

  it("a service that does not exist gets a 400, not a 500", async () => {
    const res = await createBookingRaw(frank, { serviceId: 999, date: "2026-11-10", time: "10:00" });
    expect(res.status).toBe(400);
  });

  it("notes longer than 1,000 characters are refused", async () => {
    const res = await createBookingRaw(frank, { serviceId: 1, date: "2026-11-10", time: "10:00", notes: "x".repeat(5000) });
    expect(res.status).toBe(400);
  });
});
