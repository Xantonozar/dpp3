import { describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { GET } from "@/app/api/health/route";

describe("GET /api/health (P0-T01)", () => {
  it("returns db connected", async () => {
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.db).toBe("connected");
    await mongod.stop();
  }, 60_000);
});
