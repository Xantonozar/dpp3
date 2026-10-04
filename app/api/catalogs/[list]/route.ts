import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { DropdownOption } from "@/lib/models/DropdownOption";
import { SizeSystem } from "@/lib/models/SizeSystem";
import { writeAudit } from "@/lib/services/audit";

const KNOWN_LISTS = new Set([
  "fabric_type",
  "fiber_type",
  "trim_component",
  "yarn_type",
  "printing_status",
  "packaging_type",
  "packaging_material",
  "recyclability",
  "record_type",
  "category",
  "applicable_to",
  "tier_stage",
  "evidence_type",
  "verification_method",
  "country",
]);

const OptionBody = z.object({
  code: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  aliasOf: z.string().max(80).optional(),
  requiresSpecify: z.boolean().optional(),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ list: string }> }
) {
  try {
    await requireAdmin();
    const { list } = await params;
    await dbConnect();
    if (list === "size_systems") {
      const systems = await SizeSystem.find({ active: true }).lean();
      return NextResponse.json({ data: systems });
    }
    if (!KNOWN_LISTS.has(list)) {
      return NextResponse.json({ error: "Unknown list" }, { status: 404 });
    }
    const options = await DropdownOption.find({ list }).sort({ sortOrder: 1 }).lean();
    return NextResponse.json({ data: options });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ list: string }> }
) {
  try {
    const session = await requireAdmin();
    const { list } = await params;
    if (!KNOWN_LISTS.has(list)) {
      return NextResponse.json({ error: "Unknown list" }, { status: 404 });
    }
    const parsed = OptionBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }
    await dbConnect();
    const doc = await DropdownOption.create({ list, ...parsed.data });
    await writeAudit({
      entity: "DropdownOption",
      entityId: doc._id,
      field: "create",
      newValue: { list, ...parsed.data },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    if (message.includes("duplicate") || (e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Duplicate option" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ list: string }> }
) {
  try {
    const session = await requireAdmin();
    const { list } = await params;
    const body = await req.json();
    const { code, ...patch } = OptionBody.partial().extend({ code: z.string() }).parse(body);
    await dbConnect();
    const before = await DropdownOption.findOne({ list, code }).lean();
    const doc = await DropdownOption.findOneAndUpdate(
      { list, code },
      { $set: patch },
      { new: true }
    );
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeAudit({
      entity: "DropdownOption",
      entityId: doc._id,
      field: "update",
      oldValue: before,
      newValue: doc.toObject(),
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
