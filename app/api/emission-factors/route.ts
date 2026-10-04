import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { EmissionFactor } from "@/lib/models/EmissionFactor";
import { EmissionFactorInput } from "@/lib/validators/environmental";
import { writeAudit } from "@/lib/services/audit";

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const factors = await EmissionFactor.find().sort({ type: 1, updatedAt: -1 }).lean();
    return NextResponse.json({ data: factors });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = EmissionFactorInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid emission factor", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const doc = await EmissionFactor.create(parsed.data);
    await writeAudit({
      entity: "EmissionFactor",
      entityId: doc._id,
      field: "create",
      newValue: { key: doc.key, type: doc.type },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Duplicate factor key" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
