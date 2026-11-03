// The product still works: the normal paths a customer uses. These must pass on
// both the "before" and the "after" versions; a fix that breaks them is not a fix.
import { beforeEach, describe, expect, it } from "vitest";
import { listCharges } from "@/lib/paydemo";
import {
  cancelBooking,
  checkoutEvent,
  createBooking,
  deliverWebhook,
  freshApp,
  getBooking,
  listBookings,
  login,
  PASSWORD,
  signup,
  type TestUser,
} from "./helpers/app";

let ivy: TestUser;

beforeEach(async () => {
  await freshApp();
  ivy = await signup("ivy@example.com", "Ivy");
});

describe("Normal use keeps working", () => {
  it("a customer can log in with the right password and not with a wrong one", async () => {
    expect((await login("ivy@example.com", PASSWORD)).status).toBe(200);
    expect((await login("ivy@example.com", "wrong password")).status).toBe(401);
  });

  it("a customer can book, see the booking and cancel it", async () => {
    const { id } = await createBooking(ivy, { notes: "First visit" });
    const list = await (await listBookings(ivy, { userId: ivy.id })).json();
    expect(list.bookings).toHaveLength(1);
    expect(list.bookings[0]).toMatchObject({ id, service: "Haircut", status: "pending_deposit" });
    expect((await cancelBooking(ivy, id)).status).toBe(200);
    expect((await getBooking(id)).status).toBe("cancelled");
  });

  it("the booking price comes from the service list", async () => {
    const { id } = await createBooking(ivy, { serviceId: 2 });
    expect((await getBooking(id)).priceCents).toBe(14000);
  });

  it("a signed checkout event charges the deposit and confirms the booking", async () => {
    const { id } = await createBooking(ivy);
    expect((await deliverWebhook(checkoutEvent(id))).status).toBe(200);
    expect(listCharges()).toEqual([expect.objectContaining({ amountCents: 1500 })]);
    expect((await getBooking(id)).status).toBe("confirmed");
  });
});
