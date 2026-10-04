import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Product } from "@/lib/models/Product";
import { Variant } from "@/lib/models/Variant";
import { syncVariants, countActiveVariants } from "@/lib/services/variants";

let replset: MongoMemoryReplSet;
const oid = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replset.getUri();
  const { dbConnect } = await import("@/lib/db");
  await dbConnect();
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replset.stop();
});

async function makeProduct() {
  return Product.create({
    productId: `T${Date.now()}${Math.floor(Math.random() * 1e6)}`,
    colors: [
      { name: "Black", sortOrder: 0 },
      { name: "White", sortOrder: 1 },
    ],
  });
}

describe("variants (Phase 2 gates)", () => {
  it("P2-T11: GTIN keeps leading zeros (string, trim-only)", async () => {
    const p = await makeProduct();
    const black = String(p.colors[0]._id);
    await syncVariants(p._id, [{ colorId: black, sizeKey: "m", gtin: "0123456789012" }]);
    const v = (await Variant.findOne({ productId: p._id }).lean()) as unknown as {
      gtin?: string;
    } | null;
    expect(v?.gtin).toBe("0123456789012");
  });

  it("P2-T18: countActive equals checked boxes", async () => {
    const p = await makeProduct();
    const [b, w] = p.colors.map((c: { _id: unknown }) => String(c._id));
    // Black S,M,L,XL (4) + White S,M,L (3) = 7
    await syncVariants(p._id, [
      { colorId: b, sizeKey: "s" }, { colorId: b, sizeKey: "m" },
      { colorId: b, sizeKey: "l" }, { colorId: b, sizeKey: "xl" },
      { colorId: w, sizeKey: "s" }, { colorId: w, sizeKey: "m" },
      { colorId: w, sizeKey: "l" },
    ]);
    expect(await countActiveVariants(p._id)).toBe(7);
    expect(await countActiveVariants(p._id, b)).toBe(4);
  });

  it("P2-T12: duplicate GTIN rejected before commit", async () => {
    const p = await makeProduct();
    const [b, w] = p.colors.map((c: { _id: unknown }) => String(c._id));
    await expect(
      syncVariants(p._id, [
        { colorId: b, sizeKey: "s", gtin: "111" },
        { colorId: w, sizeKey: "s", gtin: "111" },
      ])
    ).rejects.toMatchObject({ status: 409 });
    expect(await countActiveVariants(p._id)).toBe(0);
  });

  it("P2-T13/T14: unique color+size among active; inactive dup allowed", async () => {
    const p = await makeProduct();
    const b = String(p.colors[0]._id);
    await Variant.create({ productId: p._id, colorId: oid(), sizeKey: "m", active: true });
    const first = await Variant.create({ productId: p._id, colorId: b, sizeKey: "m", active: true });
    await expect(
      Variant.create({ productId: p._id, colorId: b, sizeKey: "m", active: true })
    ).rejects.toThrow();
    first.active = false;
    await first.save();
    const retry = await Variant.create({ productId: p._id, colorId: b, sizeKey: "m", active: true });
    expect(retry.active).toBe(true);
  });

  it("P2-T09: deselect archives GTIN; re-select restores it", async () => {
    const p = await makeProduct();
    const b = String(p.colors[0]._id);
    await syncVariants(p._id, [{ colorId: b, sizeKey: "m", gtin: "0999" }]);
    await syncVariants(p._id, []);
    const archived = (await Variant.findOne({ productId: p._id }).lean()) as unknown as {
      active?: boolean;
      archivedGtin?: string;
    } | null;
    expect(archived?.active).toBe(false);
    expect(archived?.archivedGtin).toBe("0999");
    await syncVariants(p._id, [{ colorId: b, sizeKey: "m" }]);
    const restored = (await Variant.findOne({ productId: p._id, active: true }).lean()) as unknown as {
      gtin?: string;
    } | null;
    expect(restored?.gtin).toBe("0999");
  });

  it("P2-T24: final save with zero variants blocked", async () => {
    const p = await makeProduct();
    await expect(syncVariants(p._id, [], { final: true })).rejects.toMatchObject({ status: 422 });
  });

  it("duplicate productId rejected", async () => {
    await Product.create({ productId: "DUP-001" });
    await expect(Product.create({ productId: "DUP-001" })).rejects.toThrow();
  });
});
