import { describe, expect, it } from "vitest";
import { validateTraceabilityFinal } from "@/lib/services/traceability";
import type { TraceabilityData } from "@/lib/services/traceability";

const okTier1 = {
  arrangement: "same" as const,
  facilities: [
    { name: "A Factory", location: "Dhaka", processes: ["cutting", "sewing", "garment_finishing"], processStatus: "Assigned" as const },
  ],
};
const okTier2 = {
  arrangement: "same" as const,
  printingStatus: "Performed" as const,
  facilities: [
    { name: "B Mill", location: "Gazipur", processes: ["knitting", "dyeing", "printing", "fabric_finishing"], processStatus: "Assigned" as const },
  ],
};
const okYarn = [
  { name: "Y Spinner", location: "Narayanganj", country: "Bangladesh", yarnType: "Ring Spun", yarnCount: "Ne 30/1", composition: "100% Cotton", referenceLot: "L1" },
];

const base: TraceabilityData = {
  mode: "final",
  originDestination: {
    countryOfManufacture: "Bangladesh",
    finalFactory: "A Factory",
    finalFactoryLocation: "Dhaka",
    destinationCountry: "Germany",
    destinationMarket: "EU",
    buyerBrand: "Acme",
  },
  tier1: okTier1,
  tier2: okTier2,
  tier3: { yarnManufacturers: okYarn },
};

describe("traceability final validation (Phase 4 gates)", () => {
  it("P4-T01/T05: Same with all processes passes", () => {
    expect(validateTraceabilityFinal(base).warnings).toEqual([]);
  });
  it("P4-T02/T03: Different/Mixed structures", () => {
    const different = {
      ...base,
      tier1: {
        arrangement: "different" as const,
        facilities: [
          { name: "A1", location: "L1", processes: ["cutting"], processStatus: "Assigned" as const },
          { name: "A2", location: "L2", processes: ["sewing"], processStatus: "Assigned" as const },
          { name: "A3", location: "L3", processes: ["garment_finishing"], processStatus: "Assigned" as const },
        ],
      },
    };
    expect(() => validateTraceabilityFinal(different)).not.toThrow();
    const badMixed = { ...base, tier1: { arrangement: "mixed" as const, facilities: [okTier1.facilities[0]] } };
    expect(() => validateTraceabilityFinal(badMixed)).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("P4-T04: same process twice rejected", () => {
    const dup = {
      ...base,
      tier1: {
        arrangement: "mixed" as const,
        facilities: [
          { name: "A1", location: "L1", processes: ["cutting", "sewing"], processStatus: "Assigned" as const },
          { name: "A2", location: "L2", processes: ["sewing", "garment_finishing"], processStatus: "Assigned" as const },
        ],
      },
    };
    expect(() => validateTraceabilityFinal(dup)).toThrow(/more than one facility/);
  });
  it("P4-T06/T07: printing Not performed / Unknown", () => {
    const notPerf = {
      ...base,
      tier2: {
        arrangement: "same" as const,
        printingStatus: "Not performed" as const,
        facilities: [
          { name: "B", location: "G", processes: ["knitting", "dyeing", "fabric_finishing"], processStatus: "Assigned" as const },
        ],
      },
    };
    expect(() => validateTraceabilityFinal(notPerf)).not.toThrow();
    const claimed = {
      ...notPerf,
      tier2: {
        ...notPerf.tier2,
        facilities: [
          { name: "B", location: "G", processes: ["knitting", "dyeing", "printing", "fabric_finishing"], processStatus: "Assigned" as const },
        ],
      },
    };
    expect(() => validateTraceabilityFinal(claimed)).toThrow(/Not performed/);
    const unknown = {
      ...base,
      tier2: {
        arrangement: "different" as const,
        printingStatus: "Unknown" as const,
        facilities: [
          { name: "B1", location: "G", processes: ["knitting"], processStatus: "Assigned" as const },
          { name: "B2", location: "G", processes: ["dyeing"], processStatus: "Assigned" as const },
          { name: "B3", location: "G", processes: ["fabric_finishing"], processStatus: "Assigned" as const },
        ],
      },
    };
    expect(() => validateTraceabilityFinal(unknown)).not.toThrow();
  });
  it("P4-T12/T13: blank and whitespace-only names rejected", () => {
    const bad = {
      ...base,
      tier1: {
        arrangement: "same" as const,
        facilities: [{ name: "   ", location: "Dhaka", processes: ["cutting", "sewing", "garment_finishing"], processStatus: "Assigned" as const }],
      },
    };
    expect(() => validateTraceabilityFinal(bad)).toThrow(/name is required/);
  });
  it("P4-T16/T25: unassigned process must be declared Unknown/Not disclosed", () => {
    const missing = {
      ...base,
      tier1: {
        arrangement: "mixed" as const,
        facilities: [
          { name: "A1", location: "L1", processes: ["cutting", "sewing", "garment_finishing"], processStatus: "Assigned" as const },
          { name: "A2", location: "L2", processes: [] as string[], processStatus: "Unknown" as const },
        ],
      },
    };
    // all processes covered -> passes (extra Unknown group is fine)
    expect(() => validateTraceabilityFinal(missing)).not.toThrow();
    const uncovered = {
      ...base,
      tier1: {
        arrangement: "same" as const,
        facilities: [{ name: "A1", location: "L1", processes: ["cutting"], processStatus: "Assigned" as const }],
      },
    };
    expect(() => validateTraceabilityFinal(uncovered)).toThrow(/not assigned/);
  });
  it("P4-T19: destination Not specified accepted", () => {
    expect(() =>
      validateTraceabilityFinal({
        ...base,
        originDestination: { ...base.originDestination, destinationCountry: "Not specified" },
      })
    ).not.toThrow();
  });
  it("P4-T11/T26: yarn min-one and country required", () => {
    expect(() => validateTraceabilityFinal({ ...base, tier3: { yarnManufacturers: [] } })).toThrow(/at least one yarn/);
    expect(() =>
      validateTraceabilityFinal({ ...base, tier3: { yarnManufacturers: [{ ...okYarn[0], country: "" }] } })
    ).toThrow(/country of origin is required/);
  });
  it("P4-T23: final-factory mismatch is a warning, not an error", () => {
    const r = validateTraceabilityFinal({
      ...base,
      originDestination: { ...base.originDestination, finalFactory: "Somewhere Else" },
    });
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("differs from the Tier 1 garment-finishing site");
  });
});
