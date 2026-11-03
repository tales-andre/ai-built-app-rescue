import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Finding 1, checked on the real production build: no file the browser downloads
// contains the payment secret key.
const SECRET = process.env.PAYDEMO_SECRET_KEY ?? "sk_demo_51BrightsideDoNotShip";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}

test("the browser bundle does not contain the payment secret key", async ({ request }) => {
  const files = walk(path.join(".next", "static")).filter((f) => f.endsWith(".js"));
  expect(files.length).toBeGreaterThan(0);
  const leaking = files.filter((f) => readFileSync(f, "utf8").includes(SECRET));
  expect(leaking).toEqual([]);

  // And the pages the server sends do not include it either.
  for (const route of ["/", "/book", "/bookings", "/login"]) {
    expect(await (await request.get(route)).text()).not.toContain(SECRET);
  }
});
