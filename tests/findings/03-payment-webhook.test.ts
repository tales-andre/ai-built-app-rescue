// Finding 3: the payment webhook does not check the provider's signature and is
// not idempotent, so anyone can trigger a charge and a retried delivery charges
// the customer's card twice.
import { beforeEach, describe, expect, it } from "vitest";
import { listCharges } from "@/lib/paydemo";
import {
  checkoutEvent,
  createBooking,
  deliverWebhook,
  freshApp,
  getBooking,
  signPayload,
  signup,
} from "../helpers/app";

let bookingId: number;

beforeEach(async () => {
  await freshApp();
  const carol = await signup("carol@example.com", "Carol");
  bookingId = (await createBooking(carol)).id;
});

describe("Finding 3: the payment webhook can be faked and can charge twice", () => {
  it("a request without the provider's signature is rejected and charges nothing", async () => {
    const res = await deliverWebhook(checkoutEvent(bookingId), { signature: null });
    expect(res.status).toBe(400);
    expect(listCharges()).toHaveLength(0);
    expect((await getBooking(bookingId)).status).toBe("pending_deposit");
  });

  it("a request signed with the wrong secret is rejected", async () => {
    const event = checkoutEvent(bookingId);
    const res = await deliverWebhook(event, {
      signature: signPayload(JSON.stringify(event), { secret: "whsec_guessed" }),
    });
    expect(res.status).toBe(400);
    expect(listCharges()).toHaveLength(0);
  });

  it("a replayed request older than 5 minutes is rejected", async () => {
    const event = checkoutEvent(bookingId);
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const res = await deliverWebhook(event, { signature: signPayload(JSON.stringify(event), { t: tenMinutesAgo }) });
    expect(res.status).toBe(400);
    expect(listCharges()).toHaveLength(0);
  });

  it("the same event delivered twice (provider retry) charges the deposit once", async () => {
    const event = checkoutEvent(bookingId, "evt_retry_1");
    expect((await deliverWebhook(event)).status).toBe(200);
    expect((await deliverWebhook(event)).status).toBe(200);
    expect(listCharges()).toHaveLength(1);
    expect((await getBooking(bookingId)).status).toBe("confirmed");
  });

  it("two checkouts for the same booking (double click) charge the deposit once", async () => {
    await deliverWebhook(checkoutEvent(bookingId, "evt_click_1"));
    await deliverWebhook(checkoutEvent(bookingId, "evt_click_2"));
    expect(listCharges()).toHaveLength(1);
  });
});
