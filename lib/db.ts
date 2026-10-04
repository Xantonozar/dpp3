import mongoose from "mongoose";

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = global as any;
if (!g.mongoose) g.mongoose = { conn: null, promise: null } as Cached;
const cached: Cached = g.mongoose;

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI ?? "";
    if (!uri) throw new Error("MONGODB_URI is not set");
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      autoIndex: process.env.APP_ENV === "prod" ? false : true,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export async function dbStatus(): Promise<"connected" | "disconnected"> {
  try {
    const c = await dbConnect();
    return c.connection.readyState === 1 ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}
