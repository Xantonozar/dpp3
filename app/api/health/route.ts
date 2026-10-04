import { NextResponse } from "next/server";
import { dbStatus } from "@/lib/db";

export async function GET() {
  const db = await dbStatus();
  const status = db === "connected" ? 200 : 200;
  return NextResponse.json(
    {
      ok: true,
      db,
      env: process.env.APP_ENV ?? "dev",
      time: new Date().toISOString(),
    },
    { status }
  );
}
