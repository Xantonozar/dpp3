import mongoose from "mongoose";

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = global as any;
if (!g.mongoose) g.mongoose = { conn: null, promise: null } as Cached;
const cached: Cached = g.mongoose;

async function checkPortOpen(port: number, host: string): Promise<boolean> {
  const net = await import("net");
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function getMongoUri(): Promise<string> {
  const envUri = process.env.MONGODB_URI ?? "";

  // If set to an external or specific test MongoMemoryServer port (not default port 27017)
  if (
    envUri &&
    !envUri.includes("127.0.0.1:27017") &&
    !envUri.includes("localhost:27017")
  ) {
    return envUri;
  }

  // If local port 27017, verify whether a native MongoDB daemon is actually listening
  if (envUri && (envUri.includes("127.0.0.1:27017") || envUri.includes("localhost:27017"))) {
    const isPortOpen = await checkPortOpen(27017, "127.0.0.1");
    if (isPortOpen) {
      return envUri;
    }
  }

  // Fallback to in-memory MongoDB in development
  if (!g.__mongodInstance) {
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      g.__mongodInstance = mongod;
      const memUri = mongod.getUri();
      process.env.MONGODB_URI = memUri;
      g.__needsBootstrapSeed = true;
      return memUri;
    } catch (err) {
      console.warn("MongoMemoryServer not available:", err);
    }
  } else {
    return g.__mongodInstance.getUri();
  }

  return envUri || "mongodb://127.0.0.1:27017/dpp_dev";
}

export async function dbConnect() {
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = (async () => {
      const uri = await getMongoUri();
      const conn = await mongoose.connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        autoIndex: process.env.APP_ENV === "prod" ? false : true,
      });

      // Set cached.conn immediately so nested dbConnect calls (e.g. from seed or createUser) return instantly
      cached.conn = conn;

      if (g.__needsBootstrapSeed) {
        g.__needsBootstrapSeed = false;
        try {
          const { seed } = await import("@/scripts/seed");
          await seed();
          const { createUser } = await import("@/scripts/create-user");
          await createUser("admin@example.com", "admin123", "Admin");
          await createUser("salmanzadid.official@gmail.com", "admin123", "Admin");
        } catch (e) {
          console.warn("Dev auto-seed error:", e);
        }
      }

      return conn;
    })();
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}

export async function dbStatus(): Promise<"connected" | "disconnected"> {
  try {
    const c = await dbConnect();
    return c.connection.readyState === 1 ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}
