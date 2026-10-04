import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { CertCatalog } from "@/lib/models/Certification";
import { CertCatalogInput } from "@/lib/validators/certification";
import { writeAudit } from "@/lib/services/audit";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await dbConnect();
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const docs = await CertCatalog.find(q ? { $text: { $search: q } } : {})
      .sort({ catalogId: 1 })
      .lean();
    return NextResponse.json({ data: docs });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = CertCatalogInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid standard", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const doc = await CertCatalog.create(parsed.data);
    await writeAudit({
      entity: "CertCatalog",
      entityId: doc._id,
      field: "create",
      newValue: { catalogId: doc.catalogId },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Duplicate catalog ID" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}

const Toggle = z.object({ catalogId: z.string(), active: z.boolean() });

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = Toggle.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    }
    await dbConnect();
    const doc = await CertCatalog.findOneAndUpdate(
      { catalogId: parsed.data.catalogId },
      { $set: { active: parsed.data.active } },
      { new: true }
    );
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeAudit({
      entity: "CertCatalog",
      entityId: doc._id,
      field: "active",
      newValue: { active: parsed.data.active },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
