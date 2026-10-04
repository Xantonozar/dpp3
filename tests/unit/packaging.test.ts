import { describe, expect, it } from "vitest";
import { validatePackaging } from "@/lib/services/packaging";

const base = {
  packagingType: { code: "polybag_carton" },
  packagingMaterials: [{ code: "ldpe" }, { code: "cardboard" }],
  recycledContentStatus: "Not Available" as const,
  recyclability: "Recyclable" as const,
  disposalReuseInstructions: "Rinse the polybag.\nReuse or recycle.",
};

describe("packaging validation (Phase 5 gates)", () => {
  it("P5-T01/T02: type + two materials save", () => {
    expect(validatePackaging(base)).toEqual({ recycledContentPercent: null });
  });
  it("P5-T03: Other needs specify", () => {
    expect(() =>
      validatePackaging({ ...base, packagingType: { code: "other" } })
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() =>
      validatePackaging({ ...base, packagingMaterials: [{ code: "other" }] })
    ).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("P5-T04/T05: 0 is 0, Not Available is null", () => {
    expect(
      validatePackaging({ ...base, recycledContentStatus: "Provided", recycledContentPercent: 0 })
    ).toEqual({ recycledContentPercent: 0 });
    expect(
      validatePackaging({ ...base, recycledContentStatus: "Not Available", recycledContentPercent: null })
    ).toEqual({ recycledContentPercent: null });
  });
  it("P5-T06: -1 and 101 rejected", () => {
    expect(() =>
      validatePackaging({ ...base, recycledContentStatus: "Provided", recycledContentPercent: -1 })
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() =>
      validatePackaging({ ...base, recycledContentStatus: "Provided", recycledContentPercent: 101 })
    ).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("P5-T08: required fields enforced", () => {
    expect(() =>
      validatePackaging({ ...base, packagingType: { code: "" } })
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() => validatePackaging({ ...base, packagingMaterials: [] })).toThrow(
      expect.objectContaining({ status: 422 })
    );
    expect(() =>
      validatePackaging({ ...base, disposalReuseInstructions: "   " })
    ).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("recyclability is never auto-set: Paper does not imply anything", () => {
    const r = validatePackaging({
      ...base,
      packagingMaterials: [{ code: "paper" }],
      recyclability: "Not Available",
    });
    expect(r).toEqual({ recycledContentPercent: null });
  });
});
