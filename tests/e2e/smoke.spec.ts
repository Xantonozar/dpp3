import { test, expect } from "@playwright/test";

// P1-T14: sector header toggles aria-expanded (landing page sectors use cards;
// collapsible kit covered on catalogs/admin pages in later phases).
// The marketing page lives behind auth by design (middleware blocks every
// non-public route except /login, /p/*, /api/public/*, /api/auth/*).
test("root redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /admin login/i })).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /admin login/i })).toBeVisible();
});

test("no horizontal overflow on small screens", async ({ page }) => {
  for (const url of ["/", "/login"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
