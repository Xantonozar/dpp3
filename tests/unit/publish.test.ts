import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { publishChecks, buildSnapshot, publishProduct } from "@/lib/services/publish";
import { rateLimit } from "@/lib/rateLimit";

let replset: MongoMemoryReplSet;

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replset.getUri();
  const { dbConnect } = await import("@/lib/db");
  await dbConnect();
  const { seed } = await import("@/scripts/seed");
  await seed();
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replset.stop();
});

async function makeReadyProduct(withMaterials: boolean) {
  const { Product } = await import("@/lib/models/Product");
  const { Variant } = await import("@/lib/models/Variant");
  const { Materials } = await import("@/lib/models/Materials");
  const { TestResult } = await import("@/lib/models/Quality");
  const p = await Product.create({
    productId: `PUB-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: "Publish Tee",
    colors: [{ name: "Black", sortOrder: 0 }],
  });
  const colorId = String(p.colors[0]._id);
  await Variant.create({ productId: p._id, colorId, sizeKey: "m", gtin: "01234", active: true });
  if (withMaterials) {
    await Materials.create({
      productId: p._id,
      mainFabric: {
        fabricType: { code: "single_jersey" },
        fibers: [{ fiberCode: "cotton", percentage: 100 }],
        compositionTotal: 100,
      },
      trims: [],
    });
  }
  // unpublished draft result must NOT leak into the snapshot
  await TestResult.create({
    productId: p._id,
    kind: "physical",
    testId: "colour_rubbing",
    resultState: "Value",
    result: { dry_grade: "2" },
    status: "FAIL",
    published: false,
  });
  return { productId: String(p._id), colorId };
}

describe("publish pipeline (Phase 9 gates)", () => {
  it("P9: checks block publish without materials", async () => {
    const { productId } = await makeReadyProduct(false);
    const { checks, canPublish } = await publishChecks(productId);
    expect(canPublish).toBe(false);
    expect(checks[1].missing.length).toBeGreaterThan(0);
    await expect(publishProduct(productId)).rejects.toMatchObject({ status: 422 });
  });

  it("P9-T01/T10: publish mints code; republish keeps URL, version + 1", async () => {
    const { productId } = await makeReadyProduct(true);
    const first = await publishProduct(productId);
    expect(first.shortCode).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(first.version).toBe(1);
    expect(first.shortCode).not.toContain("PUB-");
    const second = await publishProduct(productId);
    expect(second.shortCode).toBe(first.shortCode);
    expect(second.version).toBe(2);
    const { PublishedDpp } = await import("@/lib/models/PublishedDpp");
    expect(await PublishedDpp.countDocuments({ productId, active: true })).toBe(1);
    expect(await PublishedDpp.countDocuments({ productId })).toBe(2);
  });

  it("P9-T04: snapshot is whitelisted — no GTINs, drafts, or internal data", async () => {
    const { productId } = await makeReadyProduct(true);
    const snap = (await buildSnapshot(productId)) as unknown as {
      header: { variants: { vid: string; color: string }[] };
      quality: unknown[];
    };
    const flat = JSON.stringify(snap);
    expect(flat).not.toContain("01234");
    expect(flat).not.toContain("archivedGtin");
    expect(flat).not.toContain("passwordHash");
    expect(flat).not.toContain("createdBy");
    // draft FAIL result excluded
    expect(snap.quality).toEqual([]);
    expect(snap.header.variants[0].color).toBe("Black");
  });

  it("P9-T14/S: rate limit trips after 60/min", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 60; i++) expect(rateLimit(key).ok).toBe(true);
    const blocked = rateLimit(key);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("unpublished record is detectable for 410 handling", async () => {
    const { productId } = await makeReadyProduct(true);
    const { shortCode } = await publishProduct(productId);
    const { PublishedDpp } = await import("@/lib/models/PublishedDpp");
    await PublishedDpp.updateOne({ shortCode }, { $set: { active: false } });
    const doc = (await PublishedDpp.findOne({ shortCode }).lean()) as unknown as { active: boolean };
    expect(doc.active).toBe(false);
  });
});
