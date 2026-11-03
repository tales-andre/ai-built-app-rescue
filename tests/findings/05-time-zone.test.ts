// Finding 5: the appointment time is read in the server's time zone (UTC on most
// hosts), not the salon's. A customer who books 10:00 in Chicago gets 4:00 AM.
import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, freshApp, getBooking, signup, type TestUser } from "../helpers/app";

let erin: TestUser;

beforeEach(async () => {
  await freshApp();
  erin = await signup("erin@example.com", "Erin");
});

describe("Finding 5: appointment times are saved in the wrong time zone", () => {
  it("10:00 on Nov 10 is saved as 10:00 salon time (16:00 UTC), not 10:00 UTC", async () => {
    const { id } = await createBooking(erin, { date: "2026-11-10", time: "10:00" });
    expect((await getBooking(id)).startsAt.toISOString()).toBe("2026-11-10T16:00:00.000Z");
  });

  it("follows daylight saving time: 10:00 on Oct 30 is 15:00 UTC", async () => {
    const { id } = await createBooking(erin, { date: "2026-10-30", time: "10:00" });
    expect((await getBooking(id)).startsAt.toISOString()).toBe("2026-10-30T15:00:00.000Z");
  });

  it("opening hours are checked in salon time: 17:30 is accepted", async () => {
    const { id } = await createBooking(erin, { date: "2026-11-10", time: "17:30" });
    expect((await getBooking(id)).startsAt.toISOString()).toBe("2026-11-10T23:30:00.000Z");
  });
});
