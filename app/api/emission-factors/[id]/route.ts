import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { EmissionFactor } from "@/lib/models/EmissionFactor";
import { EmissionFactorPatch } from "@/lib/validators/environmental";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = EmissionFactorPatch.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid emission factor", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    // source and yearVersion can never be cleared once set
    if (
      (parsed.data.source !== undefined && !parsed.data.source.trim()) ||
      (parsed.data.yearVersion !== undefined && !parsed.data.yearVersion.trim())
    ) {
      return NextResponse.json(
        { error: "Source and year / version are required." },
        { status: 422 }
      );
    }
    await dbConnect();
    const before = (await EmissionFactor.findById(id).lean()) as unknown as {
      kgCo2ePerKwh: number;
      active: boolean;
    } | null;
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const doc = await EmissionFactor.findByIdAndUpdate(id, { $set: parsed.data }, { new: true });
    await writeAudit({
      entity: "EmissionFactor",
      entityId: doc._id,
      field: "update",
      oldValue: { kgCo2ePerKwh: before.kgCo2ePerKwh, active: before.active },
      newValue: parsed.data,
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
