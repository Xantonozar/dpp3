import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test("help manual requires login", async ({ page }) => {
  await page.goto(`${BASE}/help`);
  await expect(page).toHaveURL(/\/login/);
});

test("help manual renders sections, tour button and deep links", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill("test@email.com");
  await page.getByLabel(/password/i).fill("12345678");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/products/, { timeout: 20_000 });

  // context HelpLink on the dashboard opens the manual in a new tab
  const helpLink = page.locator('a[href="/help#help-workflow"]').first();
  await expect(helpLink).toBeVisible();
  await expect(helpLink).toHaveAttribute("target", "_blank");

  await page.goto(`${BASE}/help`);
  await expect(page.getByRole("heading", { name: "Help", exact: true })).toBeVisible();
  for (const id of ["help-start", "help-verdicts", "help-carbon", "help-publish", "help-troubleshoot", "help-tour"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  await expect(page.locator('nav a[href="/help"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /take the tour/i }).first()).toBeVisible();

  // deep link opens the matching collapsible section
  await page.goto(`${BASE}/help#help-troubleshoot`);
  await expect(page.locator("#help-troubleshoot button[aria-expanded]")).toHaveAttribute("aria-expanded", "true");

  // auto tour must never interrupt automation (webdriver guard)
  await page.goto(`${BASE}/products`);
  await page.waitForTimeout(1200);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
});

async function api(page: import("@playwright/test").Page, path: string, method: string, body?: unknown) {
  return page.evaluate(
    async ({ p, m, b }) => {
      const r = await fetch(p, {
        method: m,
        headers: { "Content-Type": "application/json" },
        body: b ? JSON.stringify(b) : undefined,
      });
      let data: unknown = null;
      try {
        data = await r.json();
      } catch {
        /* non-JSON */
      }
      return { ok: r.ok, status: r.status, data };
    },
    { p: path, m: method, b: body }
  );
}

test("section and catalog ? buttons start mini-tours", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill("test@email.com");
  await page.getByLabel(/password/i).fill("12345678");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/products/, { timeout: 20_000 });

  const created = await api(page, "/api/products", "POST", {
    productId: `TEST-TOUR-${Date.now() % 100000}`,
    name: "Tour Test",
  });
  expect(created.ok, JSON.stringify(created)).toBe(true);
  const pid = (created.data as { data: { _id: string } }).data._id;

  // every section/sub-section header has a "?" that tours it
  await page.goto(`${BASE}/products/${pid}`);
  const variantsHelp = page.locator('button[aria-label="Take a tour of 1. Product Variants"]');
  await expect(variantsHelp).toBeVisible();
  await variantsHelp.click();
  await expect(page.locator(".driver-popover")).toBeVisible();
  await expect(page.locator(".driver-popover-title")).toHaveText("1. Product Variants");

  // quality catalog: per-card "?" starts at that card's step
  await page.goto(`${BASE}/admin/quality-catalogs`);
  await expect(page.locator(".driver-popover")).toHaveCount(0); // destroyed on navigation
  const rslHelp = page.locator('button[aria-label="Take a tour of RSL profiles"]');
  await expect(rslHelp).toBeVisible();
  await rslHelp.click();
  await expect(page.locator(".driver-popover-title")).toHaveText("RSL profiles");

  // emission factors: header "?" tours the page
  await page.goto(`${BASE}/admin/emission-factors`);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  const efHelp = page.locator('button[aria-label="Take a tour of Emission factors"]').first();
  await expect(efHelp).toBeVisible();
  await efHelp.click();
  await expect(page.locator(".driver-popover-title")).toHaveText("Emission factors");

  // catalogs: header "?" tours picker + cards
  await page.goto(`${BASE}/admin/catalogs`);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  const catHelp = page.locator('button[aria-label="Take a tour of Catalogs"]').first();
  await expect(catHelp).toBeVisible();
  await catHelp.click();
  await expect(page.locator(".driver-popover-title")).toHaveText("Catalogs");
});
