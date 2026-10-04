import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Facility } from "@/lib/models/Facility";
import { CertRecord } from "@/lib/models/Certification";
import { Asset } from "@/lib/models/Asset";
import { CertRecordInput } from "@/lib/validators/certification";
import { validateCertRecord, certCounters } from "@/lib/services/certStatus";
import { writeAudit } from "@/lib/services/audit";

function toDate(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await dbConnect();
    const p = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    if (p.get("productId")) {
      if (!mongoose.isValidObjectId(p.get("productId")!)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      filter.productId = p.get("productId");
    }
    if (p.get("tierStage")) filter.tierStage = p.get("tierStage");
    if (p.get("status")) filter.status = p.get("status");
    if (p.get("catalogId")) filter.catalogId = p.get("catalogId");
    if (p.get("facilityId")) filter.relatedEntityId = p.get("facilityId");
    if (p.get("q")) filter.$text = { $search: p.get("q") };
    if (p.get("archived") !== "1") filter.archivedAt = null;
    const page = Math.max(1, Number(p.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(p.get("limit") ?? 50) || 50));
    const [docs, total] = await Promise.all([
      CertRecord.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CertRecord.countDocuments(filter),
    ]);
    const counters = await certCounters(
      p.get("productId") && mongoose.isValidObjectId(p.get("productId")!) ? p.get("productId")! : undefined
    );
    return NextResponse.json({ data: docs, page, limit, total, counters });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const parsed = CertRecordInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid record", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;
    if (d.relatedEntityId && !mongoose.isValidObjectId(d.relatedEntityId)) {
      return NextResponse.json({ error: "Invalid facility." }, { status: 400 });
    }
    await dbConnect();

    // Records link to a product via ?productId= (product page) or stay
    // facility-level when linkProduct is false.
    let product: { _id: unknown; productId: string; name?: string } | null = null;
    const productId = new URL(req.url).searchParams.get("productId") ?? "";
    let productRef: mongoose.Types.ObjectId | undefined;
    if (d.linkProduct && productId && mongoose.isValidObjectId(productId)) {
      product = (await Product.findById(productId).lean()) as unknown as {
        _id: unknown;
        productId: string;
        name?: string;
      } | null;
      if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
      productRef = product._id as mongoose.Types.ObjectId;
    }

    let facilityKind: string | null = null;
    if (d.relatedEntityId) {
      const f = (await Facility.findById(d.relatedEntityId).lean()) as unknown as { kind?: string } | null;
      if (!f) return NextResponse.json({ error: "Facility not found." }, { status: 404 });
      facilityKind = f.kind ?? null;
    }

    // duplicate warning: same cert ID + issuer + site (non-blocking)
    let duplicate = false;
    if (d.documentNumber?.trim() && d.issuer?.trim()) {
      const siteMatch: Record<string, unknown> = {
        catalogId: d.catalogId,
        issuer: d.issuer.trim(),
        documentNumber: d.documentNumber.trim(),
        archivedAt: null,
      };
      if (d.relatedEntityId) siteMatch.relatedEntityId = d.relatedEntityId;
      else if (productRef) siteMatch.productId = productRef;
      duplicate = (await CertRecord.countDocuments(siteMatch)) > 0;
    }

    const { warnings } = validateCertRecord(d, {
      duplicate,
      facilityKind,
      productCodes: product ? [product.productId, product.name ?? ""] : [],
    });

    const userId = (session.user as unknown as { id?: string }).id;
    let assetId: mongoose.Types.ObjectId | undefined;
    if (d.evidenceFile?.publicId) {
      const asset = await Asset.findOneAndUpdate(
        { publicId: d.evidenceFile.publicId },
        {
          $set: {
            secureUrl: d.evidenceFile.secureUrl,
            purpose: "cert_evidence",
            deliveryType: "authenticated",
            visibility: "private",
            uploadedBy: userId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      assetId = asset._id;
    }

    const doc = await CertRecord.create({
      catalogId: d.catalogId,
      recordType: d.recordType,
      category: d.category?.trim() || undefined,
      applicableTo: d.applicableTo?.trim() || undefined,
      tierStage: d.tierStage?.trim() || undefined,
      relatedEntityId: d.relatedEntityId || undefined,
      productId: productRef,
      materialId: undefined,
      batchId: d.batchId?.trim() || undefined,
      scopeText: d.scopeText.trim(),
      documentNumber: d.documentNumber?.trim() || undefined,
      issuer: d.issuer?.trim() || undefined,
      issueDate: toDate(d.issueDate),
      expiryDate: toDate(d.expiryDate),
      noStatedExpiry: d.noStatedExpiry,
      assessmentDate: toDate(d.assessmentDate),
      reviewDate: toDate(d.reviewDate),
      status: d.status,
      notApplicableReason: d.notApplicableReason?.trim() || undefined,
      rejectionReason: d.rejectionReason?.trim() || undefined,
      complianceOutcome: d.complianceOutcome,
      requirementName: d.requirementName?.trim() || undefined,
      requirementLimit: d.requirementLimit?.trim() || undefined,
      evidenceType: d.evidenceType?.trim() || undefined,
      evidenceFile: assetId,
      evidenceUrl: d.evidenceUrl?.trim() || undefined,
      publicEvidenceApproved: d.publicEvidenceApproved,
      verificationMethod: d.verificationMethod?.trim() || undefined,
      remarks: d.remarks?.trim() || undefined,
      details: {
        audit: d.details?.audit
          ? {
              auditReference: d.details.audit.auditReference?.trim() || undefined,
              auditResult: d.details.audit.auditResult?.trim() || undefined,
              findings: d.details.audit.findings?.trim() || undefined,
              remediation: d.details.audit.remediation?.trim() || undefined,
              followUpDate: toDate(d.details.audit.followUpDate),
            }
          : undefined,
        programme: d.details?.programme
          ? { participationId: d.details.programme.participationId?.trim() || undefined }
          : undefined,
        legal: d.details?.legal
          ? {
              authority: d.details.legal.authority?.trim() || undefined,
              permitNumber: d.details.legal.permitNumber?.trim() || undefined,
              effectiveDate: toDate(d.details.legal.effectiveDate),
            }
          : undefined,
        productTest: d.details?.productTest
          ? {
              testMethod: d.details.productTest.testMethod?.trim() || undefined,
              sampleRef: d.details.productTest.sampleRef?.trim() || undefined,
              labName: d.details.productTest.labName?.trim() || undefined,
              resultValue: d.details.productTest.resultValue?.trim() || undefined,
              resultUnit: d.details.productTest.resultUnit?.trim() || undefined,
              reportNumber: d.details.productTest.reportNumber?.trim() || undefined,
              reportDate: toDate(d.details.productTest.reportDate),
            }
          : undefined,
      },
      createdBy: userId,
    });
    await writeAudit({
      entity: "CertRecord",
      entityId: doc._id,
      field: "create",
      newValue: { catalogId: d.catalogId, recordType: d.recordType },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc, warnings }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
