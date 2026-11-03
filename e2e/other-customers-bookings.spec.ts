import { expect, test } from "@playwright/test";

const shots = process.env.SCREENSHOTS_DIR;

test("a logged-in customer cannot read or cancel another customer's booking", async ({ browser }) => {
  // Bob, in his own browser, signs up and books.
  const bobCtx = await browser.newContext();
  const bob = bobCtx.request;
  const bobUser = (await (await bob.post("/api/auth/signup", {
    data: { name: "Bob", email: "bob@example.com", password: "bob-password-123" },
  })).json()).user;
  const bobBooking = (await (await bob.post("/api/bookings", {
    data: { userId: bobUser.id, serviceId: 2, date: "2026-11-12", time: "14:00", notes: "Bob's private note" },
  })).json()).booking;
  expect(bobBooking.id).toBeTruthy();

  // Alice logs in through the real login page.
  const aliceCtx = await browser.newContext();
  const page = await aliceCtx.newPage();
  await aliceCtx.request.post("/api/auth/signup", {
    data: { name: "Alice", email: "alice@example.com", password: "alice-password-123" },
  });
  await aliceCtx.clearCookies();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("alice@example.com");
  await page.getByLabel("Password").fill("alice-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();

  // With her own session cookie, she asks for Bob's bookings and tries to cancel his.
  const list = await (await page.request.get(`/api/bookings?userId=${bobUser.id}`)).json();
  expect(JSON.stringify(list)).not.toContain("Bob's private note");
  const cancel = await page.request.post(`/api/bookings/${bobBooking.id}/cancel`, { data: { userId: bobUser.id } });
  expect(cancel.status()).toBe(404);

  // Even with Bob's id planted in her browser storage, the page shows only her data.
  await page.evaluate((id) => localStorage.setItem("user", JSON.stringify({ id, name: "Bob" })), bobUser.id);
  await page.reload();
  await expect(page.getByText("No bookings yet.")).toBeVisible();
  await expect(page.getByText("Bob's private note")).toHaveCount(0);
  if (shots) await page.screenshot({ path: `${shots}/app-idor-blocked.png`, clip: { x: 0, y: 0, width: 1280, height: 260 } });

  // Bob's booking is untouched.
  const bobList = await (await bob.get("/api/bookings")).json();
  expect(bobList.bookings[0]).toMatchObject({ id: bobBooking.id, status: "pending_deposit" });

  await bobCtx.close();
  await aliceCtx.close();
});
