import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Variant } from "@/lib/models/Variant";
import { VariantsSync } from "@/lib/validators/product";
import { syncVariants, countActiveVariants } from "@/lib/services/variants";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    await dbConnect();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const product = await Product.findById(id).lean();
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const variants = await Variant.find({ productId: id })
      .sort({ colorId: 1, sizeKey: 1 })
      .lean();
    const total = await countActiveVariants(id);
    return NextResponse.json({ data: { product, variants, total } });
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
    const parsed = VariantsSync.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid variants", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // rows must reference known colors of this product
    const colorIds = new Set(product.colors.map((c: { _id: unknown }) => String(c._id)));
    for (const r of parsed.data.rows) {
      if (!colorIds.has(r.colorId)) {
        return NextResponse.json(
          { error: `Unknown color: ${r.colorId}` },
          { status: 400 }
        );
      }
    }

    const result = await syncVariants(
      product._id,
      parsed.data.rows.map((r) => ({
        colorId: r.colorId,
        sizeKey: r.sizeKey,
        gtin: r.gtin,
        gtinStatus: r.gtinStatus,
      })),
      { final: parsed.data.final }
    );
    await writeAudit({
      entity: "Variant",
      field: "sync",
      newValue: { productId: String(product._id), ...result },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    const variants = await Variant.find({ productId: id }).lean();
    return NextResponse.json({ data: { ...result, variants } });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
