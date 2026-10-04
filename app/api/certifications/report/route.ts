import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { CertCatalog, CertRecord } from "@/lib/models/Certification";
import { Facility } from "@/lib/models/Facility";

// Download Report: approved-fields summary only. Private evidence and audit
// findings are omitted unless publicEvidenceApproved.
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const productId = new URL(req.url).searchParams.get("productId") ?? "";
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const [records, catalogs, facilities] = await Promise.all([
      CertRecord.find({ productId, archivedAt: null }).sort({ updatedAt: -1 }).lean(),
      CertCatalog.find({}).lean(),
      Facility.find({}).lean(),
    ]);
    const catName = new Map(
      (catalogs as unknown as { catalogId: string; displayName?: string; officialName?: string }[]).map((c) => [
        c.catalogId,
        c.displayName ?? c.officialName ?? c.catalogId,
      ])
    );
    const facName = new Map(
      (facilities as unknown as { _id: unknown; name: string; location: string }[]).map((f) => [
        String(f._id),
        `${f.name} — ${f.location}`,
      ])
    );
    const rows = (
      records as unknown as {
        catalogId: string;
        recordType: string;
        category?: string;
        applicableTo?: string;
        tierStage?: string;
        relatedEntityId?: unknown;
        scopeText: string;
        documentNumber?: string;
        issuer?: string;
        issueDate?: string;
        expiryDate?: string;
        assessmentDate?: string;
        reviewDate?: string;
        status: string;
        complianceOutcome?: string;
        requirementName?: string;
        requirementLimit?: string;
        evidenceType?: string;
        evidenceUrl?: string;
        publicEvidenceApproved?: boolean;
      }[]
    ).map((r) => ({
      standard: catName.get(r.catalogId) ?? r.catalogId,
      recordType: r.recordType,
      category: r.category,
      applicableTo: r.applicableTo,
      tierStage: r.tierStage,
      facility: r.relatedEntityId ? (facName.get(String(r.relatedEntityId)) ?? null) : null,
      scope: r.scopeText,
      certificateId: r.documentNumber,
      issuer: r.issuer,
      issueDate: r.issueDate,
      expiryDate: r.expiryDate,
      assessmentDate: r.assessmentDate,
      reviewDate: r.reviewDate,
      status: r.status,
      complianceOutcome: r.complianceOutcome,
      requirementName: r.requirementName,
      requirementLimit: r.requirementLimit,
      evidence: r.evidenceType
        ? {
            type: r.evidenceType,
            url: r.publicEvidenceApproved ? (r.evidenceUrl ?? null) : null,
          }
        : null,
    }));
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), records: rows }, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dpp-certifications.json"`,
      },
    });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
