import { describe, expect, it } from "vitest";
import { summarizeSetup } from "@/lib/setupStatus";

describe("summarizeSetup", () => {
  it("flags both items when nothing is configured", () => {
    const { items, ready } = summarizeSetup({ rslProfiles: 0, emissionFactors: 0 });
    expect(ready).toBe(false);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items.find((i) => i.key === "rsl")?.href).toBe("/admin/quality-catalogs#qc-rsl");
    expect(items.find((i) => i.key === "factors")?.href).toBe("/admin/emission-factors");
  });

  it("is ready only when both exist", () => {
    expect(summarizeSetup({ rslProfiles: 1, emissionFactors: 0 }).ready).toBe(false);
    expect(summarizeSetup({ rslProfiles: 0, emissionFactors: 3 }).ready).toBe(false);
    expect(summarizeSetup({ rslProfiles: 1, emissionFactors: 3 }).ready).toBe(true);
  });

  it("always returns two explained items with actions", () => {
    const { items } = summarizeSetup({ rslProfiles: 0, emissionFactors: 0 });
    expect(items).toHaveLength(2);
    for (const i of items) {
      expect(i.why.length).toBeGreaterThan(20);
      expect(i.cta).toBeTruthy();
    }
  });
});
