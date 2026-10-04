import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Facility } from "@/lib/models/Facility";

// Facility lookup for the certification form (stable entity IDs).
export async function GET(req: Request) {
  try {
    await requireAdmin();
    await dbConnect();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    const docs = await Facility.find(q ? { $text: { $search: q } } : {})
      .sort({ name: 1 })
      .limit(30)
      .lean();
    return NextResponse.json({ data: docs });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
