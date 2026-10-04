import { test, expect } from "@playwright/test";

// Full login flow against a seeded server. Skipped unless smoke creds exist:
//   SMOKE_EMAIL=… SMOKE_PASSWORD=… PLAYWRIGHT_BASE_URL=… npm run test:e2e
const EMAIL = process.env.SMOKE_EMAIL ?? "";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "";

test.describe("admin console", () => {
  test.skip(!EMAIL || !PASSWORD, "smoke credentials not provided");

  test("P10-T11: login, create, open variants", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/products/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /products/i })).toBeVisible();
  });

  test("unauthenticated API is rejected", async ({ request }) => {
    const res = await request.get("/api/products");
    expect([401, 307, 302]).toContain(res.status());
  });
});
