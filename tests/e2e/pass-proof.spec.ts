import { test, expect } from "@playwright/test";

// ONE-OFF proof (not part of CI): builds a full DPP with passing results,
// publishes it, and asserts the public page shows PASS. Cleanup is done by
// scripts/pass-proof-cleanup.ts afterwards.
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function api(page: unknown, path: string, method: string, body?: unknown) {
  const pg = page as import("@playwright/test").Page;
  return pg.evaluate(
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

test("PASS proof: full DPP with passing quality results", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill("test@email.com");
  await page.getByLabel(/password/i).fill("12345678");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/products/, { timeout: 20_000 });

  const code = `TEST-PASS-${Date.now() % 100000}`;
  const created = await api(page, "/api/products", "POST", { productId: code, name: "Pass Proof Tee" });
  expect(created.ok, JSON.stringify(created)).toBe(true);
  const pid = (created.data as { data: { _id: string } }).data._id;

  const rsl = await api(page, "/api/quality/catalogs", "POST", {
    key: "TEST-RSL",
    version: "2024",
    buyerProgram: "Proof buyer",
    source: "Proof RSL",
    market: "EU",
    criteria: [
      { kind: "substance", refKey: "apeo", operator: "<=", value: 100, unit: "mg/kg" },
      { kind: "substance", refKey: "formaldehyde", operator: "<=", value: 75, unit: "mg/kg" },
      { kind: "test", refKey: "colour_rubbing", operator: ">=", value: 4, unit: "grade" },
    ],
  });
  // profile may already exist from a prior run — that's fine
  console.log("rsl create:", rsl.status);

  // variants: 1 color x 1 size
  const patched = await api(page, `/api/products/${pid}`, "PATCH", {
    sizeSystemKey: "alpha",
    colors: [{ name: "Black", sortOrder: 0, status: "active" }],
  });
  expect(patched.ok, JSON.stringify(patched)).toBe(true);
  const prod = (patched.data as { data: { colors: { _id: string }[] } }).data;
  const colorId = String(prod.colors[0]._id);
  const synced = await api(page, `/api/products/${pid}/variants`, "PUT", {
    rows: [{ colorId, sizeKey: "m", gtin: "0199999999999" }],
  });
  expect(synced.ok, JSON.stringify(synced)).toBe(true);

  const mat = await api(page, `/api/products/${pid}/materials`, "PUT", {
    fabricType: { code: "single_jersey" },
    fibers: [{ fiberCode: "cotton", percentage: 100 }],
    gsm: 180,
    trims: [],
    dataSource: "Proof run",
  });
  expect(mat.ok, JSON.stringify(mat)).toBe(true);

  const trc = await api(page, `/api/products/${pid}/traceability`, "PUT", {
    mode: "final",
    originDestination: {
      countryOfManufacture: "Bangladesh",
      finalFactory: "Proof Factory",
      finalFactoryLocation: "Dhaka",
      destinationCountry: "Germany",
    },
    tier1: {
      arrangement: "same",
      facilities: [
        { name: "Proof Factory", location: "Dhaka", processes: ["cutting", "sewing", "garment_finishing"], processStatus: "Assigned" },
      ],
    },
    tier2: {
      arrangement: "same",
      printingStatus: "Performed",
      facilities: [
        { name: "Proof Mill", location: "Gazipur", processes: ["knitting", "dyeing", "printing", "fabric_finishing"], processStatus: "Assigned" },
      ],
    },
    tier3: { yarnManufacturers: [{ name: "Proof Spinner", location: "Narayanganj", country: "Bangladesh" }] },
  });
  expect(trc.ok, JSON.stringify(trc)).toBe(true);

  const rep = await api(page, `/api/products/${pid}/quality/reports`, "POST", {
    labName: "Proof Lab",
    reportNumber: "PROOF-001",
    overallResult: "Pass",
  });
  expect(rep.ok, JSON.stringify(rep)).toBe(true);

  const results: { status: string }[] = [];
  for (const payload of [
    { kind: "chemical", substanceKey: "apeo", resultState: "Value", result: { value: "16" }, unit: "mg/kg", rslProfile: { key: "TEST-RSL", version: "2024" } },
    { kind: "chemical", substanceKey: "formaldehyde", resultState: "Value", result: { value: "16" }, unit: "mg/kg", rslProfile: { key: "TEST-RSL", version: "2024" } },
    { kind: "physical", testId: "colour_rubbing", resultState: "Value", result: { dry_grade: "4-5", wet_grade: "4-5" }, unit: "grade", rslProfile: { key: "TEST-RSL", version: "2024" } },
  ]) {
    const r = await api(page, `/api/products/${pid}/quality/results`, "POST", { ...payload, published: true });
    expect(r.ok, JSON.stringify(payload) + " -> " + JSON.stringify(r)).toBe(true);
    const d = r.data as { data: { status: string }; evaluation?: string };
    console.log("RESULT:", JSON.stringify({ payload: { kind: payload.kind, key: (payload as { substanceKey?: string; testId?: string }).substanceKey ?? (payload as { testId?: string }).testId }, status: d.data.status, evaluation: d.evaluation }));
    results.push({ status: d.data.status });
  }
  console.log("result statuses:", JSON.stringify(results));
  expect(results.every((r) => r.status === "PASS")).toBe(true);

  // no-profile result stays REVIEW REQUIRED, and the card explains exactly why + how to fix
  const np = await api(page, `/api/products/${pid}/quality/results`, "POST", {
    kind: "chemical", substanceKey: "apeo", resultState: "Value",
    result: { value: "50" }, unit: "mg/kg", published: false,
  });
  expect(np.ok, JSON.stringify(np)).toBe(true);
  expect((np.data as { data: { status: string } }).data.status).toBe("REVIEW REQUIRED");
  console.log("RESULT: chemical apeo (no profile) -> REVIEW REQUIRED");

  await page.goto(`${BASE}/products/${pid}#sec-quality`);
  const openIfNeeded = async (name: RegExp) => {
    const btn = page.getByRole("button", { name }).first();
    if ((await btn.getAttribute("aria-expanded")) === "false") await btn.click();
  };
  await openIfNeeded(/4\. Quality & Lab Testing/);
  await openIfNeeded(/4\.2 Chemicals & Restricted Substances/);
  await openIfNeeded(/REVIEW REQUIRED/);
  await expect(page.getByText("No RSL profile was selected", { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /jump to profile/ })).toBeVisible();
  console.log("REVIEW EXPLAINER: visible on card (no-profile branch)");

  const pkg = await api(page, `/api/products/${pid}/packaging`, "PUT", {
    packagingType: { code: "polybag" },
    packagingMaterials: [{ code: "ldpe" }],
    recycledContentStatus: "Not Available",
    recycledContentPercent: null,
    recyclability: "Recyclable",
    disposalReuseInstructions: "Reuse or recycle.",
  });
  expect(pkg.ok, JSON.stringify(pkg)).toBe(true);

  const pub = await api(page, `/api/publish/${pid}`, "POST");
  expect(pub.ok, JSON.stringify(pub)).toBe(true);
  const shortCode = (pub.data as { data: { shortCode: string } }).data.shortCode;
  console.log(`PUBLIC_URL: ${BASE}/p/${shortCode}`);

  // logged-out check
  await page.context().clearCookies();
  await page.goto(`${BASE}/p/${shortCode}`);
  await expect(page.getByText("Pass Proof Tee").first()).toBeVisible({ timeout: 15_000 });
  const passCount = await page.getByText("PASS", { exact: true }).count();
  console.log("PASS pills on public page:", passCount);
  expect(passCount).toBeGreaterThanOrEqual(3);
  await expect(page.getByText("criterion not configured")).toHaveCount(0);
  await page.locator("#s-quality").screenshot({ path: "pass-proof-quality.png" });

  console.log("PAGEERRORS: " + (errors.length ? errors.join(" | ") : "(none)"));
  console.log("PRODUCT_ID: " + pid);
});
