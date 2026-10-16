import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Variant } from "@/lib/models/Variant";
import { Asset } from "@/lib/models/Asset";
import { ProductPatch, MAX_COLORS } from "@/lib/validators/product";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

async function findProduct(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Product.findById(id);
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    await dbConnect();
    const doc = await findProduct((await params).id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const parsed = ProductPatch.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid product", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const doc = await findProduct((await params).id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = parsed.data;
    const userId = (session.user as unknown as { id?: string }).id;

    // size system change: require explicit resetVariants when variants exist
    if (data.sizeSystemKey && data.sizeSystemKey !== doc.sizeSystemKey) {
      const activeCount = await Variant.countDocuments({
        productId: doc._id,
        active: true,
      });
      if (activeCount > 0 && !data.resetVariants) {
        return NextResponse.json(
          {
            error:
              "Size system change needs confirmation: pass resetVariants:true to archive existing variants, or cancel.",
            activeCount,
          },
          { status: 409 }
        );
      }
      if (data.resetVariants) {
        await Variant.updateMany(
          { productId: doc._id, active: true },
          {
            $set: { active: false, archivedAt: new Date(), gtinStatus: "Archived" },
            $rename: { gtin: "archivedGtin" },
          }
        );
      }
      doc.sizeSystemKey = data.sizeSystemKey;
    }

    for (const f of ["styleNo", "name", "brand", "season", "gender", "productType", "buyerBrand", "status"] as const) {
      if (data[f] !== undefined) (doc as unknown as Record<string, unknown>)[f] = data[f];
    }

    if (data.colors) {
      const active = data.colors.filter((c) => c.status !== "archived");
      if (active.length > MAX_COLORS) {
        return NextResponse.json(
          { error: `Maximum ${MAX_COLORS} colors` },
          { status: 422 }
        );
      }
      // new colors start with no sizes — sizes sync separately via PUT variants
      const next: unknown[] = [];
      for (const [i, c] of data.colors.entries()) {
        const images: unknown[] = [];
        for (const [j, img] of (c.images ?? []).entries()) {
          let assetId: mongoose.Types.ObjectId | undefined;
          if (img.publicId) {
            const asset = await Asset.findOneAndUpdate(
              { publicId: img.publicId },
              {
                $set: {
                  secureUrl: img.secureUrl,
                  purpose: "color_image",
                  deliveryType: "upload",
                  visibility: "public",
                  ownerModel: "Product",
                  ownerId: doc._id,
                  uploadedBy: userId,
                },
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            assetId = asset._id;
          }
          images.push({
            asset: assetId,
            publicId: img.publicId,
            secureUrl: img.secureUrl,
            altText: img.altText,
            sortOrder: img.sortOrder ?? j,
          });
        }
        const existing = c._id
          ? doc.colors.find((x: { _id: unknown }) => String(x._id) === c._id)
          : null;
        next.push({
          _id: existing
            ? (existing as { _id: unknown })._id
            : new mongoose.Types.ObjectId(),
          name: c.name,
          colorCode: c.colorCode,
          images,
          sortOrder: c.sortOrder ?? i,
          status: c.status ?? "active",
        });
      }
      (doc as unknown as { colors: unknown }).colors = next;
    }

    await doc.save();
    await writeAudit({
      entity: "Product",
      entityId: doc._id,
      field: "update",
      newValue: data,
      changedBy: userId,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    await dbConnect();
    const doc = await findProduct((await params).id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await Variant.deleteMany({ productId: doc._id });
    await doc.deleteOne();
    await writeAudit({
      entity: "Product",
      entityId: doc._id,
      field: "delete",
      oldValue: { productId: doc.productId },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
