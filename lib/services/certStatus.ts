import { z } from "zod";
import mongoose from "mongoose";
import { CertRecord } from "../models/Certification";
import { CertRecordInput } from "../validators/certification";

export type CertData = z.infer<typeof CertRecordInput>;

function err(message: string, status = 422) {
  return Object.assign(new Error(message), { status });
}

export type CertContext = {
  /** true when another record already has this cert ID + issuer + site */
  duplicate?: boolean;
  /** facility kind for tier/entity check, e.g. "garment" */
  facilityKind?: string | null;
  /** product identifiers to check facility-scope coverage */
  productCodes?: string[];
};

const TIER_KIND: [RegExp, string][] = [
  [/tier\s*1/i, "garment"],
  [/tier\s*2/i, "fabric"],
  [/tier\s*3/i, "yarn"],
  [/tier\s*4/i, "other"],
];

/**
 * Status rules. Throws 422 on blocking violations, returns warnings.
 * Never invents an Expired status: expiryDate is display-only.
 */
export function validateCertRecord(input: CertData, ctx: CertContext = {}): { warnings: string[] } {
  const warnings: string[] = [];
  const rt = input.recordType;

  if (!input.scopeText?.trim()) throw err("Scope is required — a facility certificate must always show its scope text.");

  if (input.status === "Not Applicable" || input.complianceOutcome === "Not applicable") {
    if (!input.notApplicableReason?.trim()) throw err("A reason is required for Not Applicable.");
  }
  if (input.complianceOutcome === "Compliant" || input.complianceOutcome === "Non-compliant") {
    if (!input.requirementName?.trim() || !input.assessmentDate) {
      throw err("A Compliant / Non-compliant outcome needs the exact requirement name, its limit where one applies, and the assessment date.");
    }
  }
  if (input.issueDate && input.expiryDate) {
    if (new Date(input.expiryDate) < new Date(input.issueDate)) {
      throw err("Expiry date cannot be before the issue date.");
    }
  }

  const need = (cond: boolean, message: string) => {
    if (!cond) throw err(message);
  };
  const hasEvidence = !!(input.evidenceFile?.publicId || input.evidenceUrl?.trim());
  if (rt === "Certification" || rt === "Management System") {
    need(!!input.issuer?.trim(), `${rt} needs an issuer.`);
    need(!!input.documentNumber?.trim(), `${rt} needs a certificate / document ID.`);
    need(!!input.issueDate, `${rt} needs an issue date.`);
    need(input.noStatedExpiry || !!input.expiryDate, `${rt} needs an expiry date or “no stated expiry”.`);
    need(!!input.evidenceType, `${rt} needs an evidence type.`);
    need(hasEvidence, `${rt} needs evidence (uploaded file or URL).`);
  } else if (rt === "Audit/Assessment") {
    need(!!input.assessmentDate, "Audit/Assessment needs an audit date.");
    need(!!input.details?.audit?.auditReference?.trim(), "Audit/Assessment needs an audit reference.");
  } else if (rt === "Programme") {
    need(!!input.details?.programme?.participationId?.trim(), "Programme needs a participation / site ID.");
    need(!!input.reviewDate, "Programme needs a review date.");
  } else if (rt === "Legal/Statutory") {
    need(!!input.details?.legal?.authority?.trim(), "Legal/Statutory needs an authority.");
    need(!!input.details?.legal?.permitNumber?.trim(), "Legal/Statutory needs a permit number.");
    need(!!input.relatedEntityId, "Legal/Statutory needs a facility.");
    need(!!input.details?.legal?.effectiveDate, "Legal/Statutory needs an effective date.");
  } else if (rt === "Product Test/Requirement") {
    need(!!input.details?.productTest?.testMethod?.trim(), "Product Test needs a test method.");
    need(!!input.details?.productTest?.labName?.trim(), "Product Test needs a lab name.");
    need(!!input.details?.productTest?.reportNumber?.trim(), "Product Test needs a report number.");
  }

  // Fairtrade (catalog 07) requires the exact scheme name and scope
  if (input.catalogId === "07") {
    need(!!input.issuer?.trim() && /fairtrade/i.test(input.issuer), "Fairtrade needs the exact scheme name as issuer.");
  }

  if (ctx.duplicate) {
    warnings.push("Same certificate ID + issuer already exists for this site — confirm the scope is distinct before saving.");
  }
  if (ctx.facilityKind && input.tierStage) {
    const want = TIER_KIND.find(([re]) => re.test(input.tierStage!))?.[1];
    if (want && want !== ctx.facilityKind) {
      warnings.push(`Tier/stage suggests “${want}” but the linked facility is a “${ctx.facilityKind}” site — correct the tier or add a reason.`);
    }
  }
  if (input.relatedEntityId) {
    const codes = ctx.productCodes ?? [];
    if (codes.length > 0) {
      const scope = input.scopeText.toLowerCase();
      const covered = codes.some((c) => c && scope.includes(c.toLowerCase()));
      if (!covered) {
        warnings.push("Scope text does not mention this product — a facility certificate does not certify every garment made there.");
      }
    }
  }
  return { warnings };
}

/** Live counters from active saved records; archived excluded; one record counts once. */
export async function certCounters(productId?: string) {
  const match: Record<string, unknown> = { archivedAt: null };
  if (productId) match.productId = new mongoose.Types.ObjectId(productId);
  const byStatus = await CertRecord.aggregate([
    { $match: { ...match } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const byOutcome = await CertRecord.aggregate([
    { $match: { ...match } },
    { $group: { _id: "$complianceOutcome", n: { $sum: 1 } } },
  ]);
  const s: Record<string, number> = {};
  for (const r of byStatus as { _id: string; n: number }[]) s[r._id ?? "Not Assessed"] = r.n;
  const o: Record<string, number> = {};
  for (const r of byOutcome as { _id: string; n: number }[]) o[r._id ?? "Not assessed"] = r.n;
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  return {
    certification: {
      Total: total,
      Verified: s.Verified ?? 0,
      "Not Assessed": s["Not Assessed"] ?? 0,
      "Not Applicable": s["Not Applicable"] ?? 0,
      "Rejected/Invalid": s["Rejected/Invalid"] ?? 0,
    },
    compliance: {
      Total: total,
      Compliant: o.Compliant ?? 0,
      "Non-compliant": o["Non-compliant"] ?? 0,
      "Not Assessed": (o["Not assessed"] ?? 0) + (o["Not Assessed"] ?? 0),
      "Not Applicable": (o["Not applicable"] ?? 0) + (o["Not Applicable"] ?? 0),
    },
  };
}
