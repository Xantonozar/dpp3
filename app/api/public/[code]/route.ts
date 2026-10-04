import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { PublishedDpp } from "@/lib/models/PublishedDpp";
import { recordScan } from "@/lib/services/publish";
import { rateLimit, rateLimitKey } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

const cors = { "Access-Control-Allow-Origin": "*" };

// Public read-only JSON: same snapshot as the QR page. Writes return 405.
export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const { ok, retryAfterSec } = rateLimit(rateLimitKey(req));
  if (!ok) {
    return NextResponse.json({ error: "Rate limited." }, { status: 429, headers: { ...cors, "Retry-After": String(retryAfterSec) } });
  }
  await dbConnect();
  const doc = (await PublishedDpp.findOne({ shortCode: code }).sort({ version: -1 }).lean()) as unknown as {
    productId: unknown;
    active: boolean;
    snapshot: unknown;
    version: number;
  } | null;
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: cors });
  }
  if (!doc.active) {
    return NextResponse.json(
      { error: "This product passport is no longer available." },
      { status: 410, headers: cors }
    );
  }
  void recordScan(String(doc.productId), code, req.headers.get("x-vercel-ip-country") ?? undefined);
  return NextResponse.json({ data: doc.snapshot, version: doc.version }, { headers: cors });
}

// Public writes are read-only: every mutation method returns 405.
export async function POST() {
  return NextResponse.json({ error: "Read-only." }, { status: 405, headers: cors });
}
export async function PUT() {
  return NextResponse.json({ error: "Read-only." }, { status: 405, headers: cors });
}
export async function PATCH() {
  return NextResponse.json({ error: "Read-only." }, { status: 405, headers: cors });
}
export async function DELETE() {
  return NextResponse.json({ error: "Read-only." }, { status: 405, headers: cors });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
