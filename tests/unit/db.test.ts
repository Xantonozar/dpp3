import { describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { dbConnect } from "@/lib/db";

describe("dbConnect reuses one connection (P0-T02)", () => {
  it("parallel calls share the same connection", async () => {
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const conns = await Promise.all([
      dbConnect(),
      dbConnect(),
      dbConnect(),
      dbConnect(),
      dbConnect(),
    ]);
    const first = conns[0].connection.id;
    for (const c of conns) expect(c.connection.id).toBe(first);
    await mongod.stop();
  }, 60_000);
});
