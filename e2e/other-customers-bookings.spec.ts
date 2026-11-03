import { expect, test } from "@playwright/test";
import { shotPath } from "./shots";

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

  // Alice signs up, then logs in through the real login page and books for herself.
  const aliceCtx = await browser.newContext();
  const page = await aliceCtx.newPage();
  const aliceUser = (await (await aliceCtx.request.post("/api/auth/signup", {
    data: { name: "Alice", email: "alice@example.com", password: "alice-password-123" },
  })).json()).user;
  await aliceCtx.clearCookies();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("alice@example.com");
  await page.getByLabel("Password").fill("alice-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await page.request.post("/api/bookings", {
    data: { userId: aliceUser.id, serviceId: 3, date: "2026-11-13", time: "11:00", notes: "Alice's own booking" },
  });

  // In her browser storage she swaps her id for Bob's (one value, in the dev tools)
  // and reloads "My bookings".
  await page.evaluate((id) => localStorage.setItem("user", JSON.stringify({ id, name: "Bob" })), bobUser.id);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("booking").first()).toBeVisible();
  const shot = shotPath("app-idor.png");
  if (shot) await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1280, height: 250 } });

  // The page shows only her own booking, and the server still knows she is Alice.
  await expect(page.getByText("Bob's private note")).toHaveCount(0);
  await expect(page.getByText("Alice's own booking")).toBeVisible();
  await expect(page.getByTestId("who")).toContainText("Alice");

  // With her own session cookie, she asks the API for Bob's bookings and tries to cancel his.
  const list = await (await page.request.get(`/api/bookings?userId=${bobUser.id}`)).json();
  expect(JSON.stringify(list)).not.toContain("Bob's private note");
  const cancel = await page.request.post(`/api/bookings/${bobBooking.id}/cancel`, { data: { userId: bobUser.id } });
  expect(cancel.status()).toBe(404);

  // Bob's booking is untouched.
  const bobList = await (await bob.get("/api/bookings")).json();
  expect(bobList.bookings[0]).toMatchObject({ id: bobBooking.id, status: "pending_deposit" });

  await bobCtx.close();
  await aliceCtx.close();
});
