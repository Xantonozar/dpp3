import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { ProductCreate } from "@/lib/validators/product";
import { writeAudit } from "@/lib/services/audit";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await dbConnect();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20)
    );
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };
    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);
    return NextResponse.json({ data: items, page, limit, total });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = ProductCreate.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid product", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const doc = await Product.create({
      ...parsed.data,
      colors: [],
      createdBy: (session.user as unknown as { id?: string }).id,
    });
    await writeAudit({
      entity: "Product",
      entityId: doc._id,
      field: "create",
      newValue: { productId: doc.productId },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "Duplicate product ID" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status });
  }
}
