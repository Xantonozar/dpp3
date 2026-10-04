import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { PublishedDpp } from "@/lib/models/PublishedDpp";
import { publishChecks, publishProduct } from "@/lib/services/publish";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ productId: string }> };

// Review data: sector checks + current live publication (if any)
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { productId } = await params;
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const product = await Product.findById(productId).lean();
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { checks, canPublish } = await publishChecks(productId);
    const live = (await PublishedDpp.findOne({ productId, active: true }).sort({ version: -1 }).lean()) as unknown as {
      shortCode: string;
      version: number;
      publishedAt?: string;
    } | null;
    return NextResponse.json({
      data: {
        checks,
        canPublish,
        live: live
          ? {
              shortCode: live.shortCode,
              version: live.version,
              publishedAt: live.publishedAt,
            }
          : null,
      },
    });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

// Publish: same URL on republish, version + 1
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { productId } = await params;
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const data = await publishProduct(
      productId,
      (session.user as unknown as { id?: string }).id
    );
    revalidatePath(`/p/${data.shortCode}`);
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    const missing = (e as { missing?: string[] }).missing;
    return NextResponse.json({ error: message, ...(missing ? { missing } : {}) }, { status });
  }
}

// Unpublish: QR keeps resolving to a friendly "no longer available" page
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { productId } = await params;
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const live = await PublishedDpp.findOne({ productId, active: true }).sort({ version: -1 });
    if (!live) return NextResponse.json({ error: "Nothing published." }, { status: 404 });
    live.set("active", false);
    await live.save();
    await writeAudit({
      entity: "PublishedDpp",
      entityId: live._id,
      field: "unpublish",
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    revalidatePath(`/p/${(live as unknown as { shortCode: string }).shortCode}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
