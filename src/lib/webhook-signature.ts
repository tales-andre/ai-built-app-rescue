import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a PayDemo webhook signature. Header format:
 *   paydemo-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
 * The timestamp is part of the signed text, so an old request cannot be replayed
 * with a fresh time. Must be called with the raw body, before JSON parsing.
 */
export function verifyPayDemoSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  { toleranceSeconds = 300, now = Date.now() } = {},
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(parts.v1 ?? "")) return false;
  if (Math.abs(now / 1000 - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}
