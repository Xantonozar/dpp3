import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Packaging } from "@/lib/models/Packaging";
import { PackagingInput } from "@/lib/validators/packaging";
import { validatePackaging } from "@/lib/services/packaging";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const product = await Product.findById(id).lean();
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const doc = await Packaging.findOne({ productId: id }).lean();
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = PackagingInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid packaging", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { recycledContentPercent } = validatePackaging(parsed.data);
    const userId = (session.user as unknown as { id?: string }).id;
    const doc = await Packaging.findOneAndUpdate(
      { productId: id },
      {
        $set: {
          packagingType: {
            code: parsed.data.packagingType.code,
            other: parsed.data.packagingType.other?.trim() || undefined,
          },
          packagingMaterials: parsed.data.packagingMaterials.map((m) => ({
            code: m.code,
            other: m.other?.trim() || undefined,
          })),
          recycledContentPercent,
          recycledContentStatus: parsed.data.recycledContentStatus,
          recyclability: parsed.data.recyclability,
          // line breaks preserved as-is
          disposalReuseInstructions: parsed.data.disposalReuseInstructions,
          dataSource: parsed.data.dataSource?.trim() || undefined,
          updatedBy: userId,
        },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeAudit({
      entity: "Packaging",
      entityId: doc._id,
      field: "save",
      newValue: { recyclability: doc.recyclability },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
