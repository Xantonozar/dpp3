import { describe, expect, it } from "vitest";
import { calcComposition, canonicalFiber } from "@/lib/calc/composition";
import { validateMaterials } from "@/lib/services/materials";

const ALIASES = { spandex: "elastane", elastane: "elastane" };

const base = {
  fibers: [
    { fiberCode: "cotton", percentage: 95 },
    { fiberCode: "elastane", percentage: 5 },
  ],
  trims: [],
};

describe("composition calc (P3-T01–T04)", () => {
  it("T01: [95, 5] = 100 valid", () => {
    expect(calcComposition([95, 5])).toEqual({ total: 100, valid: true });
  });
  it("T02: [80, 10] = 90 invalid", () => {
    expect(calcComposition([80, 10])).toEqual({ total: 90, valid: false });
  });
  it("T03: [80, 30] = 110 invalid", () => {
    expect(calcComposition([80, 30])).toEqual({ total: 110, valid: false });
  });
  it("T04: thirds within tolerance", () => {
    expect(calcComposition([33.33, 33.33, 33.34]).valid).toBe(true);
  });
});

describe("materials validation (Phase 3 gates)", () => {
  it("T05: 95 + 5 saves", () => {
    expect(validateMaterials(base, ALIASES)).toEqual({ compositionTotal: 100 });
  });
  it("T06/T20/T21: totals != 100 rejected with 422 showing sum", () => {
    expect(() =>
      validateMaterials(
        { ...base, fibers: [{ fiberCode: "cotton", percentage: 80 }, { fiberCode: "polyester", percentage: 10 }] },
        ALIASES
      )
    ).toThrow(expect.objectContaining({ status: 422 }));
    try {
      validateMaterials(
        { ...base, fibers: [{ fiberCode: "cotton", percentage: 80 }, { fiberCode: "polyester", percentage: 10 }] },
        ALIASES
      );
    } catch (e) {
      expect((e as Error).message).toContain("90");
    }
    expect(() =>
      validateMaterials(
        { ...base, fibers: [{ fiberCode: "cotton", percentage: 80 }, { fiberCode: "polyester", percentage: 30 }] },
        ALIASES
      )
    ).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("T11: elastane + spandex canonical duplicate", () => {
    expect(() =>
      validateMaterials(
        {
          ...base,
          fibers: [
            { fiberCode: "elastane", percentage: 50 },
            { fiberCode: "spandex", percentage: 50 },
          ],
        },
        ALIASES
      )
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(canonicalFiber("Spandex", ALIASES)).toBe("elastane");
  });
  it("T09/T14: bad percentages and GSM rejected", () => {
    expect(() =>
      validateMaterials({ ...base, fibers: [{ fiberCode: "cotton", percentage: -5 }] }, ALIASES)
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() =>
      validateMaterials({ ...base, fibers: [{ fiberCode: "cotton", percentage: 101 }] }, ALIASES)
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() => validateMaterials({ ...base, gsm: 0 }, ALIASES)).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("T10: Other fiber needs a name", () => {
    expect(() =>
      validateMaterials({ ...base, fibers: [{ fiberCode: "other", percentage: 100 }] }, ALIASES)
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(
      validateMaterials(
        { ...base, fibers: [{ fiberCode: "other", otherName: "Hemp", percentage: 100 }] },
        ALIASES
      )
    ).toEqual({ compositionTotal: 100 });
  });
  it("T24: no fiber rows blocked", () => {
    expect(() => validateMaterials({ ...base, fibers: [] }, ALIASES)).toThrow(
      "Add at least one fiber to describe the main fabric."
    );
  });
  it("T17/T25: identical trim dup blocked, distinct detail allowed", () => {
    expect(() =>
      validateMaterials(
        {
          ...base,
          trims: [
            { componentCode: "sewing_thread", materialType: "Polyester" },
            { componentCode: "sewing_thread", materialType: "polyester " },
          ],
        },
        ALIASES
      )
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(
      validateMaterials(
        {
          ...base,
          trims: [
            { componentCode: "sewing_thread", materialType: "Polyester" },
            { componentCode: "sewing_thread", materialType: "Cotton" },
          ],
        },
        ALIASES
      )
    ).toEqual({ compositionTotal: 100 });
  });
});
