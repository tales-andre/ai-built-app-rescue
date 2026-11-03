// Finding 4: sign-up checks "does this email exist?" and then inserts, with no
// unique index, so two requests at the same moment (or a different letter case)
// create two accounts for one person.
import { beforeEach, describe, expect, it } from "vitest";
import { allUsers, freshApp, signupRaw } from "../helpers/app";

beforeEach(async () => {
  await freshApp();
});

const accountsFor = async (email: string) =>
  (await allUsers()).filter((u) => u.email.trim().toLowerCase() === email.toLowerCase()).length;

describe("Finding 4: one person can end up with two accounts", () => {
  it("two sign-ups with the same email at the same moment create one account", async () => {
    const [a, b] = await Promise.all([signupRaw("dana@example.com"), signupRaw("dana@example.com")]);
    expect(await accountsFor("dana@example.com")).toBe(1);
    const statuses = [a.status, b.status];
    expect(statuses.filter((s) => s >= 200 && s < 300)).toHaveLength(1);
    expect(statuses).toContain(409);
  });

  it("Dana@Example.com and dana@example.com are the same account", async () => {
    expect((await signupRaw("dana@example.com")).ok).toBe(true);
    expect((await signupRaw("Dana@Example.com")).status).toBe(409);
    expect(await accountsFor("dana@example.com")).toBe(1);
  });
});
