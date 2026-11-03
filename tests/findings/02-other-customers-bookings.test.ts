// Finding 2 (IDOR): the bookings API trusts the user id it is sent, so any
// customer can list and cancel any other customer's bookings.
import { beforeEach, describe, expect, it } from "vitest";
import {
  bookingsOf,
  cancelBooking,
  createBooking,
  createBookingRaw,
  freshApp,
  getBooking,
  listBookings,
  signup,
  type TestUser,
} from "../helpers/app";

let alice: TestUser;
let bob: TestUser;
let bobsBooking: { id: number };

beforeEach(async () => {
  await freshApp();
  alice = await signup("alice@example.com", "Alice");
  bob = await signup("bob@example.com", "Bob");
  bobsBooking = await createBooking(bob, { notes: "Bob's private note" });
});

describe("Finding 2: a customer can see and cancel other customers' bookings", () => {
  it("Alice cannot list Bob's bookings by editing the request", async () => {
    const res = await listBookings(alice, { userId: bob.id });
    const body = await res.json();
    const ids = (body.bookings ?? []).map((b: { id: number }) => b.id);
    expect(ids).not.toContain(bobsBooking.id);
  });

  it("Alice cannot cancel Bob's booking", async () => {
    const res = await cancelBooking(alice, bobsBooking.id, { userId: bob.id });
    expect(res.status).toBe(404);
    expect((await getBooking(bobsBooking.id)).status).toBe("pending_deposit");
  });

  it("Alice cannot create a booking in Bob's name", async () => {
    const res = await createBookingRaw(alice, { userId: bob.id, serviceId: 1, date: "2026-11-10", time: "11:00" });
    // Either refused, or booked for Alice herself; never a 500, never for Bob.
    expect([201, 400, 403]).toContain(res.status);
    if (res.status === 201) expect((await res.json()).booking.userId).toBe(alice.id);
    expect((await bookingsOf(bob.id)).map((b) => b.id)).toEqual([bobsBooking.id]);
  });

  it("a logged-out visitor gets 401, not someone's bookings", async () => {
    const res = await listBookings(null, { userId: bob.id });
    expect(res.status).toBe(401);
  });

  it("Bob can still list and cancel his own booking", async () => {
    const list = await (await listBookings(bob, { userId: bob.id })).json();
    expect(list.bookings.map((b: { id: number }) => b.id)).toContain(bobsBooking.id);
    const res = await cancelBooking(bob, bobsBooking.id);
    expect(res.status).toBe(200);
    expect((await getBooking(bobsBooking.id)).status).toBe("cancelled");
  });
});
