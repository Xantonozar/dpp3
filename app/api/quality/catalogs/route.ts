import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { TestCatalog, Substance, RSLProfile } from "@/lib/models/Quality";
import { RSLProfileInput } from "@/lib/validators/quality";
import { writeAudit } from "@/lib/services/audit";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await dbConnect();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const [tests, substances, rsl] = await Promise.all([
      TestCatalog.find(q ? { $text: { $search: q } } : {}).sort({ testId: 1 }).lean(),
      Substance.find(
        q ? { $or: [{ name: new RegExp(q, "i") }, { casNumbers: q }] } : {}
      ).sort({ name: 1 }).lean(),
      RSLProfile.find({}).sort({ key: 1, version: 1 }).lean(),
    ]);
    return NextResponse.json({ data: { tests, substances, rsl } });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = RSLProfileInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid RSL profile", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const doc = await RSLProfile.create(parsed.data);
    await writeAudit({
      entity: "RSLProfile",
      entityId: doc._id,
      field: "create",
      newValue: { key: doc.key, version: doc.version },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Duplicate RSL key + version" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}

const ToggleBody = z.object({
  active: z.boolean().optional(),
  editionVerified: z.boolean().optional(),
  methodId: z.string().optional(),
  testId: z.string(),
});

// Admin toggles a test's active flag or verifies a method edition (audited).
export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = ToggleBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    }
    await dbConnect();
    const doc = await TestCatalog.findOne({ testId: parsed.data.testId });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (parsed.data.active !== undefined) doc.active = parsed.data.active;
    if (parsed.data.editionVerified !== undefined && parsed.data.methodId) {
      const m = (doc.methods as { methodId?: string; editionVerified?: boolean }[]).find(
        (x) => x.methodId === parsed.data.methodId
      );
      if (m) m.editionVerified = parsed.data.editionVerified;
    }
    await doc.save();
    await writeAudit({
      entity: "TestCatalog",
      entityId: doc._id,
      field: "update",
      newValue: parsed.data,
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    // RSL profiles deactivate, never delete (history) — same rule as dropdowns
    const doc = await RSLProfile.findByIdAndUpdate(id, { $set: { active: false } }, { new: true });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
