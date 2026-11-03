// Found while fixing finding 1: the session signing key also had a hard-coded
// fallback, so a production server without SESSION_SECRET would accept cookies
// anyone can forge. Production now refuses to sign or read sessions without it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId, sessionCookie } from "@/lib/session";

afterEach(() => vi.unstubAllEnvs());

describe("Session secret", () => {
  it("a production server without SESSION_SECRET refuses to create sessions", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => sessionCookie(1)).toThrow(/SESSION_SECRET/);
  });

  it("a cookie signed with another secret is not accepted", () => {
    vi.stubEnv("SESSION_SECRET", "attacker-guess");
    const forged = sessionCookie(1).split(";")[0];
    vi.stubEnv("SESSION_SECRET", "the-real-secret");
    expect(getSessionUserId(new Request("http://x", { headers: { cookie: forged } }))).toBeNull();
  });
});

describe("Session cookie", () => {
  it("in production the session cookie is HttpOnly and only sent over HTTPS (Secure)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "the-real-secret");
    const attrs = sessionCookie(1).split(";").map((a) => a.trim()).slice(1);
    expect(attrs).toContain("HttpOnly");
    expect(attrs).toContain("Secure");
  });
});
