import { expect, test } from "@playwright/test";

const shots = process.env.SCREENSHOTS_DIR;

test("a customer signs up, books a haircut and pays the deposit", async ({ page }) => {
  await page.goto("/signup");
  await page.waitForLoadState("networkidle"); // wait for React to take over the form
  await page.getByLabel("Name").fill("Maya");
  await page.getByLabel("Email").fill("maya@example.com");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();

  await page.goto("/book");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Service").selectOption({ label: "Haircut: $55.00 (45 min)" });
  await page.getByLabel("Date").fill("2026-11-10");
  await page.getByLabel("Time").fill("10:00");
  await page.getByLabel("Notes").fill("Short on the sides, please");
  if (shots) await page.screenshot({ path: `${shots}/app-book.png` });
  await page.getByRole("button", { name: "Book" }).click();

  const booking = page.getByTestId("booking");
  await expect(booking).toContainText("Haircut");
  await expect(booking).toContainText("Tue, Nov 10, 10:00 AM (salon time)");
  await expect(booking).toContainText("pending deposit");

  // Server route -> PayDemo simulator -> signed webhook -> deposit charged once.
  await booking.getByRole("button", { name: "Pay deposit" }).click();
  await expect(booking).toContainText("confirmed");
  if (shots) await page.screenshot({ path: `${shots}/app-bookings.png`, clip: { x: 0, y: 0, width: 1280, height: 300 } });
});
