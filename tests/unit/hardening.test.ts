import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  const { dbConnect } = await import("@/lib/db");
  await dbConnect();
  const { Product } = await import("@/lib/models/Product");
  const { Variant } = await import("@/lib/models/Variant");
  const { PublishedDpp } = await import("@/lib/models/PublishedDpp");
  const { CertRecord } = await import("@/lib/models/Certification");
  const { TestResult } = await import("@/lib/models/Quality");
  const { LabReport } = await import("@/lib/models/Quality");
  for (const m of [Product, Variant, PublishedDpp, CertRecord, TestResult, LabReport]) {
    await m.syncIndexes();
  }
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function collectStages(node: Record<string, unknown> | undefined, out: string[] = []): string[] {
  if (!node) return out;
  if (typeof node.stage === "string") out.push(node.stage);
  for (const k of ["inputStage", "inputStages"]) {
    const v = node[k] as unknown;
    if (Array.isArray(v)) v.forEach((x) => collectStages(x as Record<string, unknown>, out));
    else if (v && typeof v === "object") collectStages(v as Record<string, unknown>, out);
  }
  return out;
}

function planStages(explain: unknown): string[] {
  const e = explain as {
    queryPlanner?: { winningPlan?: Record<string, unknown> };
    stages?: { $cursor?: { queryPlanner?: { winningPlan?: Record<string, unknown> } } }[];
  };
  if (e.stages?.[0]?.$cursor?.queryPlanner?.winningPlan) {
    return collectStages(e.stages[0].$cursor.queryPlanner.winningPlan);
  }
  return collectStages(e.queryPlanner?.winningPlan);
}

describe("P10-T06: query plans use indexes (IXSCAN), no COLLSCAN", () => {
  it("product lookup + default list sort", async () => {
    const { Product } = await import("@/lib/models/Product");
    expect(planStages(await Product.findOne({ productId: "X" }).explain())).toContain("IXSCAN");
    const sortPlan = planStages(await Product.find({}).sort({ updatedAt: -1 }).limit(20).explain());
    expect(sortPlan).toContain("IXSCAN");
    expect(sortPlan).not.toContain("COLLSCAN");
  });
  it("variant live counts", async () => {
    const { Variant } = await import("@/lib/models/Variant");
    const pid = new mongoose.Types.ObjectId();
    // same predicate shape as countDocuments in services/variants.ts
    expect(planStages(await Variant.find({ productId: pid, active: true }).explain())).toContain("IXSCAN");
  });
  it("public QR lookup by shortCode", async () => {
    const { PublishedDpp } = await import("@/lib/models/PublishedDpp");
    expect(planStages(await PublishedDpp.findOne({ shortCode: "abc" }).explain())).toContain("IXSCAN");
  });
  it("cert counters aggregation", async () => {
    const { CertRecord } = await import("@/lib/models/Certification");
    const stages = planStages(
      await CertRecord.aggregate([
        { $match: { archivedAt: null } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]).explain()
    );
    expect(stages).toContain("IXSCAN");
    expect(stages).not.toContain("COLLSCAN");
  });
  it("test results by product + status; lab report triple", async () => {
    const { TestResult, LabReport } = await import("@/lib/models/Quality");
    const pid = new mongoose.Types.ObjectId();
    expect(
      planStages(await TestResult.find({ productId: pid, status: "PASS" }).explain())
    ).toContain("IXSCAN");
    expect(
      planStages(await LabReport.findOne({ productId: pid, labName: "L", reportNumber: "1" }).explain())
    ).toContain("IXSCAN");
  });
});

describe("P10-T03/T05: access model guards (static)", () => {
  const apiDir = path.resolve(process.cwd(), "app/api");
  const routeFiles: string[] = [];
  (function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") routeFiles.push(p);
    }
  })(apiDir);

  const PUBLIC = ["app/api/health/route.ts", "app/api/public/[code]/route.ts", "app/api/auth/[...nextauth]/route.ts"];

  it("every non-public route calls requireAdmin()", () => {
    const offenders = routeFiles
      .map((f) => path.relative(process.cwd(), f).replace(/\\/g, "/"))
      .filter((f) => !PUBLIC.includes(f))
      .filter((f) => !fs.readFileSync(path.resolve(process.cwd(), f), "utf8").includes("requireAdmin("));
    expect(offenders).toEqual([]);
  });
  it("public surface is read-only + rate-limited; middleware gates the rest", () => {
    const pub = fs.readFileSync(path.resolve(process.cwd(), "app/api/public/[code]/route.ts"), "utf8");
    expect(pub).toContain("rateLimit(");
    expect(pub).toContain("status: 405");
    const mw = fs.readFileSync(path.resolve(process.cwd(), "middleware.ts"), "utf8");
    for (const p of ["/login", "/p/", "/api/public/", "/api/auth/"]) expect(mw).toContain(p);
  });
  it("no secrets committed; env files ignored", () => {
    const ignore = fs.readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toContain(".env");
    // .env.local legitimately exists for local dev — it must stay untracked.
    // gitignore ".env*" covers ".env", ".env.local" and friends.
    expect(fs.existsSync(path.resolve(process.cwd(), ".env"))).toBe(false);
    const example = fs.readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");
    expect(example).not.toContain("sk-");
  });
  it("private files stay authenticated", () => {
    const lib = fs.readFileSync(path.resolve(process.cwd(), "lib/cloudinary.ts"), "utf8");
    expect(lib).toContain("authenticated");
    expect(lib).toContain("expires_at");
  });
});

describe("P10-T04: injection strings rejected or neutralized", () => {
  it("operator injection in productId rejected", async () => {
    const { ProductCreate } = await import("@/lib/validators/product");
    expect(ProductCreate.safeParse({ productId: { $ne: null } }).success).toBe(false);
    expect(ProductCreate.safeParse({ productId: "<script>alert(1)</script>" }).success).toBe(true);
  });
  it("materials: string percentages and negative values rejected", async () => {
    const { MaterialsInput } = await import("@/lib/validators/materials");
    const good = {
      fibers: [{ fiberCode: "cotton", percentage: 100 }],
      trims: [],
    };
    expect(MaterialsInput.safeParse({ ...good, fibers: [{ fiberCode: "cotton", percentage: "100" }] }).success).toBe(false);
    expect(MaterialsInput.safeParse({ ...good, fibers: [{ fiberCode: "cotton", percentage: -5 }] }).success).toBe(false);
  });
  it("unknown operator keys stripped, never stored", async () => {
    const { TraceabilityInput } = await import("@/lib/validators/traceability");
    const parsed = TraceabilityInput.safeParse({ mode: "draft", $where: "x" } as unknown as Record<string, unknown>);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("$where" in parsed.data).toBe(false);
  });
  it("no Expired status smuggled into certification", async () => {
    const { CertRecordInput } = await import("@/lib/validators/certification");
    expect(
      CertRecordInput.safeParse({ catalogId: "03", recordType: "Certification", scopeText: "s", status: "Expired" }).success
    ).toBe(false);
  });
  it("RSL limits cannot ride along result entry", async () => {
    const { TestResultInput } = await import("@/lib/validators/quality");
    const parsed = TestResultInput.safeParse({
      kind: "physical",
      testId: "colour_rubbing",
      criteria: [{ operator: "<=", value: 1 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("criteria" in parsed.data).toBe(false);
  });
});
