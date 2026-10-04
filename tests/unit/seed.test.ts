import { describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { seed } from "@/scripts/seed";
import { DropdownOption } from "@/lib/models/DropdownOption";
import { SizeSystem } from "@/lib/models/SizeSystem";

describe("catalog seed (P1-T08, P1-T05–T07)", () => {
  it("is idempotent and rejects duplicate {list, code}", async () => {
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const a = await seed();
    const b = await seed();
    expect(a.dropdowns).toBe(b.dropdowns);
    expect(
      await DropdownOption.countDocuments({ list: "fiber_type" })
    ).toBeGreaterThanOrEqual(16);
    expect(await SizeSystem.countDocuments()).toBe(3);
    // duplicate insert rejected by unique index
    await expect(
      DropdownOption.create({ list: "fiber_type", code: "cotton", label: "Dup" })
    ).rejects.toThrow();
    // labels unique per list: UI keys options by code but duplicate labels
    // confuse users and once crashed React with duplicate keys
    const lists: string[] = await DropdownOption.distinct("list");
    for (const list of lists) {
      const docs = (await DropdownOption.find({ list }).lean()) as unknown as { label: string }[];
      const labels = docs.map((d) => d.label);
      expect(new Set(labels).size, `duplicate labels in ${list}`).toBe(labels.length);
    }
    await mongoose.disconnect();
    await mongod.stop();
  }, 120_000);
});
