// Finding 7: login has no attempt limit, so a script can guess passwords forever.
import { beforeEach, describe, expect, it } from "vitest";
import { freshApp, login, PASSWORD, signup } from "../helpers/app";

beforeEach(async () => {
  await freshApp();
  await signup("grace@example.com", "Grace");
});

describe("Finding 7: unlimited password guessing", () => {
  it("after 5 wrong passwords, login is paused for that account, even with the right password", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login("grace@example.com", `guess-${i}`)).status).toBe(401);
    }
    const res = await login("grace@example.com", PASSWORD);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("the limit is per account, whatever the letter case", async () => {
    for (let i = 0; i < 5; i++) await login(i % 2 ? "GRACE@example.com" : "grace@example.com", `guess-${i}`);
    expect((await login("Grace@Example.com", PASSWORD)).status).toBe(429);
  });

  it("a couple of typos followed by the right password still logs in", async () => {
    await login("grace@example.com", "typo-1");
    await login("grace@example.com", "typo-2");
    expect((await login("grace@example.com", PASSWORD)).status).toBe(200);
  });
});
