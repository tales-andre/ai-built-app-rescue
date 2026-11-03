// Finding 8: errors are hidden instead of handled. The build ignores type errors
// (one of them is a real bug: the salon "closed on Sunday" rule never works), and
// the payment webhook swallows failures, so a failed deposit charge is never retried.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { failNextCharges, listCharges } from "@/lib/paydemo";
import {
  checkoutEvent,
  createBookingRaw,
  createBooking,
  deliverWebhook,
  freshApp,
  getBooking,
  signup,
  type TestUser,
} from "../helpers/app";

let henry: TestUser;

beforeEach(async () => {
  await freshApp();
  henry = await signup("henry@example.com", "Henry");
});

describe("Finding 8: errors are hidden instead of handled", () => {
  it("the production build does not skip type errors", () => {
    const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).not.toMatch(/ignoreBuildErrors:\s*true/);
  });

  it("the code type-checks", () => {
    const tsc = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc");
    let output = "";
    try {
      execFileSync(process.execPath, [tsc, "--noEmit", "-p", "tsconfig.json"], { encoding: "utf8", stdio: "pipe" });
    } catch (err) {
      output = String((err as { stdout?: string }).stdout ?? err);
    }
    expect(output).toBe("");
  }, 120_000);

  it("the salon is closed on Sundays: a Sunday booking is refused (the bug the type error hid)", async () => {
    const res = await createBookingRaw(henry, { serviceId: 1, date: "2026-11-08", time: "10:00" });
    expect(res.status).toBe(400);
  });

  it("when the deposit charge fails, the webhook answers 500 so the provider retries", async () => {
    const { id } = await createBooking(henry);
    const event = checkoutEvent(id, "evt_outage_1");
    failNextCharges(1);
    expect((await deliverWebhook(event)).status).toBe(500);
    expect((await getBooking(id)).status).toBe("pending_deposit");

    // The provider retries the same event later, and this time it goes through.
    expect((await deliverWebhook(event)).status).toBe(200);
    expect(listCharges()).toHaveLength(1);
    expect((await getBooking(id)).status).toBe("confirmed");
  });
});
