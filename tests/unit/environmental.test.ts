import { describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { calcEnergy } from "@/lib/calc/energy";
import { validateEnvironmentalInputs } from "@/lib/services/environmental";
import { EmissionFactorInput } from "@/lib/validators/environmental";

// NOTE: 0.50 / 0 are test-code-only fixtures (guide illustration). They are
// never seeded — production starts with zero emission factors.
const TEST_EF = { grid: 0.5, solar: 0 };

const guideInputs = {
  garmentWeightKg: 0.17,
  cuttingUtilizationPct: 85,
  knittingKwhPerKg: 0.85,
  dyeingKwhPerKg: 1.8,
  fabricFinishingKwhPerKg: 0.75,
  cuttingKwhPerGarment: 0.12,
  sewingKwhPerGarment: 0.18,
  garmentFinishingKwhPerGarment: 0.1,
  gridSharePct: 65,
  solarSharePct: 35,
};

describe("energy calc (Phase 6 gates, fixture only)", () => {
  it("P6-T01: 0.17kg @ 85% -> 0.20kg fabric", () => {
    expect(calcEnergy(guideInputs, TEST_EF).fabricRequiredKg).toBe(0.2);
  });
  it("P6-T02: kWh/kg converts first", () => {
    const r = calcEnergy(guideInputs, TEST_EF);
    expect(r.kwhPerGarment.knitting).toBeCloseTo(0.17, 2);
    expect(r.kwhPerGarment.dyeing).toBeCloseTo(0.36, 2);
    expect(r.kwhPerGarment.fabricFinishing).toBeCloseTo(0.15, 2);
  });
  it("P6-T03: total = 1.08 kWh", () => {
    expect(calcEnergy(guideInputs, TEST_EF).totalEnergyKwh).toBeCloseTo(1.08, 2);
  });
  it("P6-T04: 65/35 split", () => {
    const r = calcEnergy(guideInputs, TEST_EF);
    expect(r.gridEnergyKwh).toBeCloseTo(0.702, 3);
    expect(r.solarEnergyKwh).toBeCloseTo(0.378, 3);
  });
  it("P6-T05: carbon = 0.351 kg CO2e", () => {
    expect(calcEnergy(guideInputs, TEST_EF).carbonKgCo2e).toBeCloseTo(0.351, 3);
  });
  it("P6-T06: 60 + 30 throws the exact message", () => {
    expect(() =>
      calcEnergy({ ...guideInputs, gridSharePct: 60, solarSharePct: 30 }, TEST_EF)
    ).toThrow("Grid + Solar percentage must equal 100%.");
  });
});

describe("environmental validation", () => {
  it("P6-T07: bad ranges rejected; P6-T14: shares != 100 rejected", () => {
    expect(() => validateEnvironmentalInputs({ ...guideInputs, garmentWeightKg: 0 })).toThrow(
      expect.objectContaining({ status: 422 })
    );
    expect(() => validateEnvironmentalInputs({ ...guideInputs, cuttingUtilizationPct: 101 })).toThrow(
      expect.objectContaining({ status: 422 })
    );
    expect(() => validateEnvironmentalInputs({ ...guideInputs, sewingKwhPerGarment: -1 })).toThrow(
      expect.objectContaining({ status: 422 })
    );
    expect(() =>
      validateEnvironmentalInputs({ ...guideInputs, gridSharePct: 60, solarSharePct: 30 })
    ).toThrow("Grid + Solar percentage must equal 100%.");
  });
  it("P6-T20: factor without source or year rejected", () => {
    expect(
      EmissionFactorInput.safeParse({ key: "g", type: "grid", kgCo2ePerKwh: 0.5, source: "", yearVersion: "2024" })
        .success
    ).toBe(false);
    expect(
      EmissionFactorInput.safeParse({ key: "g", type: "grid", kgCo2ePerKwh: 0.5, source: "S", yearVersion: "" })
        .success
    ).toBe(false);
  });
  it("P6-T21: production seed creates zero emission factors", async () => {
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const { seed } = await import("@/scripts/seed");
    await seed();
    const { EmissionFactor } = await import("@/lib/models/EmissionFactor");
    expect(await EmissionFactor.countDocuments()).toBe(0);
    await mongoose.disconnect();
    await mongod.stop();
  }, 120_000);
});
