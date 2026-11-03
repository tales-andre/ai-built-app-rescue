// Finding 3: the payment webhook does not check the provider's signature and is
// not idempotent, so anyone can trigger a charge and a retried delivery charges
// the customer's card twice.
//
// The fix has three layers: the event id table, the booking status checked under
// a row lock, and the provider's idempotency key. Some tests below switch a layer
// off on the provider side, so each remaining layer is tested on its own.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCharges } from "@/lib/paydemo";
import {
  cancelBooking,
  checkoutEvent,
  createBooking,
  deliverWebhook,
  freshApp,
  getBooking,
  signPayload,
  signup,
  type TestUser,
} from "../helpers/app";

// Provider-side switches for the simulated PayDemo (test only):
//  ignoreIdempotencyKey: the provider charges again even for a repeated key
//  loseNextResponse:     the provider charges, but the answer never reaches the app
const provider = vi.hoisted(() => ({ ignoreIdempotencyKey: false, loseNextResponse: false }));
vi.mock("@/lib/paydemo", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/paydemo")>();
  return {
    ...real,
    charge: async (params: Parameters<typeof real.charge>[0]) => {
      const result = await real.charge(provider.ignoreIdempotencyKey ? { ...params, idempotencyKey: undefined } : params);
      if (provider.loseNextResponse) {
        provider.loseNextResponse = false;
        throw new Error("PayDemo API: connection reset after the charge was made");
      }
      return result;
    },
  };
});

let carol: TestUser;
let bookingId: number;

beforeEach(async () => {
  await freshApp();
  provider.ignoreIdempotencyKey = false;
  provider.loseNextResponse = false;
  carol = await signup("carol@example.com", "Carol");
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

  it("two checkouts for the same booking (double click) charge once, even if the provider ignores the idempotency key", async () => {
    provider.ignoreIdempotencyKey = true;
    expect((await deliverWebhook(checkoutEvent(bookingId, "evt_click_1"))).status).toBe(200);
    expect((await deliverWebhook(checkoutEvent(bookingId, "evt_click_2"))).status).toBe(200);
    expect(listCharges()).toHaveLength(1);
  });

  it("two checkouts for the same booking arriving at the same moment charge once, without the idempotency key", async () => {
    provider.ignoreIdempotencyKey = true;
    const results = await Promise.all([
      deliverWebhook(checkoutEvent(bookingId, "evt_same_time_1")),
      deliverWebhook(checkoutEvent(bookingId, "evt_same_time_2")),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(listCharges()).toHaveLength(1);
  });

  it("a checkout event for a cancelled booking charges nothing and does not confirm it", async () => {
    provider.ignoreIdempotencyKey = true;
    expect((await cancelBooking(carol, bookingId)).status).toBe(200);
    expect((await deliverWebhook(checkoutEvent(bookingId))).status).toBe(200);
    expect(listCharges()).toHaveLength(0);
    expect((await getBooking(bookingId)).status).toBe("cancelled");
  });

  it("if the provider's answer is lost after charging, the retry does not charge again (idempotency key)", async () => {
    const event = checkoutEvent(bookingId, "evt_lost_answer");
    provider.loseNextResponse = true;
    expect((await deliverWebhook(event)).status).toBe(500);
    expect((await getBooking(bookingId)).status).toBe("pending_deposit");
    expect((await deliverWebhook(event)).status).toBe(200);
    expect(listCharges()).toHaveLength(1);
    expect((await getBooking(bookingId)).status).toBe("confirmed");
  });

  it("a signed event without booking details gets 400, not 500, and charges nothing", async () => {
    const res = await deliverWebhook({ id: "evt_no_data", type: "checkout.completed" });
    expect(res.status).toBe(400);
    expect(listCharges()).toHaveLength(0);
  });
});
