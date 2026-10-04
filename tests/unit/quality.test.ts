import { describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { testEvaluator, parseGrade, NOT_CONFIGURED } from "@/lib/services/testEvaluator";

const RUBBING_SCHEMA = [
  { key: "dry_grade", label: "Dry grade", type: "grade" as const, scale: "grey_scale_1_5" },
  { key: "wet_grade", label: "Wet grade", type: "grade" as const, scale: "grey_scale_1_5" },
];
const min4 = { operator: "<=" as const, value: 4, unit: "grade" };
// note: fastness criteria are minimum grades; the evaluator compares with the
// operator as stored — a "min 4" rule is stored as >= 4.
const min4ge = { operator: ">=" as const, value: 4, unit: "grade" };

describe("testEvaluator (Phase 7 gates)", () => {
  it("P7-T09: rubbing 4-5/4-5 vs min 4 -> PASS", () => {
    const r = testEvaluator({
      kind: "physical",
      resultState: "Value",
      result: { dry_grade: "4-5", wet_grade: "4-5" },
      resultSchema: RUBBING_SCHEMA,
      unit: "grade",
      criterion: min4ge,
    });
    expect(r.status).toBe("PASS");
  });
  it("P7-T10: rubbing 3 vs min 4 -> FAIL", () => {
    const r = testEvaluator({
      kind: "physical",
      resultState: "Value",
      result: { dry_grade: "4-5", wet_grade: "3" },
      resultSchema: RUBBING_SCHEMA,
      unit: "grade",
      criterion: min4ge,
    });
    expect(r.status).toBe("FAIL");
  });
  it("P7-T11/T30: no criterion -> REVIEW REQUIRED with exact message", () => {
    const r = testEvaluator({
      kind: "physical",
      resultState: "Value",
      result: { dry_grade: "4-5", wet_grade: "4-5" },
      resultSchema: RUBBING_SCHEMA,
      unit: "grade",
      criterion: null,
    });
    expect(r.status).toBe("REVIEW REQUIRED");
    expect(r.message).toBe(NOT_CONFIGURED);
    expect(NOT_CONFIGURED).toBe("Result recorded - criterion not configured");
  });
  it("P7-T12: unit mismatch -> REVIEW REQUIRED", () => {
    const r = testEvaluator({
      kind: "physical",
      resultState: "Value",
      result: { length_pct: "-2", width_pct: "-1" },
      resultSchema: [
        { key: "length_pct", label: "Length", type: "number" as const, unit: "%" },
        { key: "width_pct", label: "Width", type: "number" as const, unit: "%" },
      ],
      unit: "%",
      criterion: { operator: "<=" as const, value: 50, unit: "N" },
    });
    expect(r.status).toBe("REVIEW REQUIRED");
    expect(r.message).toMatch(/Unit mismatch/);
    void min4;
  });
  it("P7-T13: formaldehyde 16 vs <= 75 -> PASS (illustration profile, inline)", () => {
    const r = testEvaluator({
      kind: "chemical",
      resultState: "Value",
      result: { value: "16" },
      resultSchema: [{ key: "value", label: "Result", type: "number" as const, unit: "mg/kg" }],
      unit: "mg/kg",
      criterion: { operator: "<=" as const, value: 75, unit: "mg/kg" },
    });
    expect(r.status).toBe("PASS");
  });
  it("chemical plain { value } without a resultSchema still evaluates", () => {
    const r = testEvaluator({
      kind: "chemical",
      resultState: "Value",
      result: { value: "16" },
      resultSchema: [],
      unit: "mg/kg",
      criterion: { operator: "<=" as const, value: 75, unit: "mg/kg" },
    });
    expect(r.status).toBe("PASS");
    const bad = testEvaluator({
      kind: "chemical",
      resultState: "Value",
      result: { value: "not-a-number" },
      resultSchema: [],
      unit: "mg/kg",
      criterion: { operator: "<=" as const, value: 75, unit: "mg/kg" },
    });
    expect(bad.status).toBe("REVIEW REQUIRED");
  });
  it("P7-T14: ND keeps reporting limit, never zero", () => {
    const r = testEvaluator({
      kind: "chemical",
      resultState: "ND",
      reportingLimit: 16,
      unit: "mg/kg",
      criterion: { operator: "<=" as const, value: 75, unit: "mg/kg" },
    });
    expect(r.status).toBe("PASS");
    expect(r.message).toContain("16");
    const bad = testEvaluator({
      kind: "chemical",
      resultState: "ND",
      reportingLimit: 100,
      unit: "mg/kg",
      criterion: { operator: "<=" as const, value: 75, unit: "mg/kg" },
    });
    expect(bad.status).toBe("REVIEW REQUIRED");
  });
  it("P7-T03/T06: Blue Wool 1-8 allowed; grey 6 rejected, 4-5 accepted", () => {
    expect(parseGrade("6", "blue_wool_1_8")).toBe(6);
    expect(parseGrade("4-5", "grey_scale_1_5")).toBe(4.5);
    expect(() => parseGrade("6", "grey_scale_1_5")).toThrow(
      expect.objectContaining({ status: 422 })
    );
  });
  it("method mismatch -> REVIEW REQUIRED", () => {
    const r = testEvaluator({
      kind: "physical",
      resultState: "Value",
      result: { dry_grade: "5", wet_grade: "5" },
      resultSchema: RUBBING_SCHEMA,
      unit: "grade",
      methodId: "iso_105_x12",
      criterion: { ...min4ge, methodId: "other_method" },
    });
    expect(r.status).toBe("REVIEW REQUIRED");
  });
  it("Not Tested / Not Applicable / Unknown states", () => {
    expect(testEvaluator({ kind: "physical", resultState: "Not Tested" }).status).toBe("NOT TESTED");
    expect(testEvaluator({ kind: "chemical", resultState: "Not Applicable" }).status).toBe("NOT APPLICABLE");
    expect(testEvaluator({ kind: "physical", resultState: "Unknown" }).status).toBe("REVIEW REQUIRED");
  });
});

describe("quality seed (P7-T01)", () => {
  it("12 unique tests; sweat once; 11 substances", async () => {
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const { seed } = await import("@/scripts/seed");
    await seed();
    await seed();
    const { TestCatalog, Substance } = await import("@/lib/models/Quality");
    expect(await TestCatalog.countDocuments()).toBe(12);
    expect(await TestCatalog.countDocuments({ testId: "colour_perspiration" })).toBe(1);
    expect(await Substance.countDocuments()).toBe(11);
    expect(await Substance.findOne({ key: "formaldehyde" })).toMatchObject({ casNumbers: ["50-00-0"] });
    const pfas = (await Substance.findOne({ key: "pfas" }).lean()) as unknown as {
      casNumbers: string[];
    } | null;
    expect((pfas?.casNumbers ?? []).length).toBe(0);
    await mongoose.disconnect();
    await mongod.stop();
  }, 120_000);
});
