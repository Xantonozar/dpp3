import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { CertRecord } from "@/lib/models/Certification";
import { Asset } from "@/lib/models/Asset";
import { CertRecordInput } from "@/lib/validators/certification";
import { validateCertRecord } from "@/lib/services/certStatus";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

function toDate(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const doc = await CertRecord.findById(id).lean();
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
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = CertRecordInput.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid record" }, { status: 400 });
    }
    await dbConnect();
    const before = await CertRecord.findOne({ _id: id, archivedAt: null });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const merged = { ...before.toObject(), ...parsed.data };
    const { warnings } = validateCertRecord(
      {
        ...merged,
        catalogId: String(merged.catalogId),
        recordType: merged.recordType,
        scopeText: String(merged.scopeText ?? ""),
      } as Parameters<typeof validateCertRecord>[0],
      {}
    );

    const d = parsed.data;
    const patch: Record<string, unknown> = {};
    for (const k of [
      "category", "applicableTo", "tierStage", "batchId", "scopeText", "documentNumber",
      "issuer", "status", "notApplicableReason", "rejectionReason", "complianceOutcome",
      "requirementName", "requirementLimit", "evidenceType", "evidenceUrl",
      "verificationMethod", "remarks",
    ] as const) {
      if (d[k] !== undefined) patch[k] = typeof d[k] === "string" ? (d[k] as string).trim() || undefined : d[k];
    }
    for (const k of ["issueDate", "expiryDate", "assessmentDate", "reviewDate"] as const) {
      if (d[k] !== undefined) patch[k] = toDate(d[k]);
    }
    if (d.noStatedExpiry !== undefined) patch.noStatedExpiry = d.noStatedExpiry;
    if (d.publicEvidenceApproved !== undefined) patch.publicEvidenceApproved = d.publicEvidenceApproved;
    if (d.details !== undefined) patch.details = d.details;
    if (d.evidenceFile?.publicId) {
      const asset = await Asset.findOneAndUpdate(
        { publicId: d.evidenceFile.publicId },
        {
          $set: {
            secureUrl: d.evidenceFile.secureUrl,
            purpose: "cert_evidence",
            deliveryType: "authenticated",
            visibility: "private",
            uploadedBy: (session.user as unknown as { id?: string }).id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      patch.evidenceFile = asset._id;
    }

    const doc = await CertRecord.findByIdAndUpdate(id, { $set: patch }, { new: true });
    await writeAudit({
      entity: "CertRecord",
      entityId: doc._id,
      field: "update",
      oldValue: { status: before.status },
      newValue: patch,
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc, warnings });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

// UI delete = archive (history kept, counters exclude archived)
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const doc = await CertRecord.findByIdAndUpdate(
      id,
      { $set: { archivedAt: new Date() } },
      { new: true }
    );
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeAudit({
      entity: "CertRecord",
      entityId: doc._id,
      field: "archive",
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

