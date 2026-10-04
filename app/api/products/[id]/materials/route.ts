import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Materials } from "@/lib/models/Materials";
import { DropdownOption } from "@/lib/models/DropdownOption";
import { MaterialsInput } from "@/lib/validators/materials";
import { validateMaterials } from "@/lib/services/materials";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

async function fiberAliases(): Promise<Record<string, string>> {
  const opts = await DropdownOption.find({ list: "fiber_type" }).lean();
  const map: Record<string, string> = {};
  for (const o of opts as unknown as { code: string; aliasOf?: string }[]) {
    map[o.code.trim().toLowerCase()] = (o.aliasOf ?? o.code).trim().toLowerCase();
  }
  map.spandex ??= "elastane";
  map.elastane ??= "elastane";
  return map;
}

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
    const doc = await Materials.findOne({ productId: id }).lean();
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
    const parsed = MaterialsInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid materials", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { compositionTotal } = validateMaterials(parsed.data, await fiberAliases());
    const userId = (session.user as unknown as { id?: string }).id;
    const doc = await Materials.findOneAndUpdate(
      { productId: id },
      {
        $set: {
          mainFabric: {
            fabricType: parsed.data.fabricType,
            fibers: parsed.data.fibers,
            compositionTotal,
            gsm: parsed.data.gsm ?? undefined,
            construction: parsed.data.construction,
          },
          trims: parsed.data.trims ?? [],
          dataSource: parsed.data.dataSource,
          updatedBy: userId,
        },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeAudit({
      entity: "Materials",
      entityId: doc._id,
      field: "save",
      newValue: { compositionTotal },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
