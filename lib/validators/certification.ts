import { z } from "zod";

const Details = z.object({
  audit: z
    .object({
      auditReference: z.string().trim().max(200).optional(),
      auditResult: z.string().trim().max(200).optional(),
      findings: z.string().trim().max(4000).optional(),
      remediation: z.string().trim().max(4000).optional(),
      followUpDate: z.string().max(30).optional(),
    })
    .optional(),
  programme: z.object({ participationId: z.string().trim().max(200).optional() }).optional(),
  legal: z
    .object({
      authority: z.string().trim().max(200).optional(),
      permitNumber: z.string().trim().max(200).optional(),
      effectiveDate: z.string().max(30).optional(),
    })
    .optional(),
  productTest: z
    .object({
      testMethod: z.string().trim().max(300).optional(),
      sampleRef: z.string().trim().max(200).optional(),
      labName: z.string().trim().max(200).optional(),
      resultValue: z.string().trim().max(200).optional(),
      resultUnit: z.string().trim().max(40).optional(),
      reportNumber: z.string().trim().max(120).optional(),
      reportDate: z.string().max(30).optional(),
    })
    .optional(),
});

export const CertRecordInput = z.object({
  catalogId: z.string().trim().min(1, "Standard is required.").max(40),
  recordType: z.enum([
    "Certification",
    "Audit/Assessment",
    "Programme",
    "Management System",
    "Legal/Statutory",
    "Product Test/Requirement",
  ]),
  category: z.string().trim().max(80).optional(),
  applicableTo: z.string().trim().max(80).optional(),
  tierStage: z.string().trim().max(120).optional(),
  relatedEntityId: z.string().max(40).optional(),
  linkProduct: z.boolean().optional().default(true),
  materialId: z.string().max(40).optional(),
  batchId: z.string().trim().max(120).optional(),
  scopeText: z.string().trim().min(1, "Scope is required.").max(4000),
  documentNumber: z.string().trim().max(200).optional(),
  issuer: z.string().trim().max(200).optional(),
  issueDate: z.string().max(30).optional(),
  expiryDate: z.string().max(30).optional(),
  noStatedExpiry: z.boolean().optional().default(false),
  assessmentDate: z.string().max(30).optional(),
  reviewDate: z.string().max(30).optional(),
  status: z.enum(["Verified", "Not Assessed", "Not Applicable", "Rejected/Invalid"]).optional().default("Verified"),
  notApplicableReason: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
  complianceOutcome: z.enum(["Not assessed", "Compliant", "Non-compliant", "Not applicable"]).optional(),
  requirementName: z.string().trim().max(300).optional(),
  requirementLimit: z.string().trim().max(300).optional(),
  evidenceType: z.string().trim().max(80).optional(),
  evidenceFile: z
    .object({ publicId: z.string().min(1).max(300), secureUrl: z.string().max(1000).optional() })
    .optional(),
  evidenceUrl: z.string().trim().max(1000).optional(),
  publicEvidenceApproved: z.boolean().optional().default(false),
  verificationMethod: z.string().trim().max(300).optional(),
  remarks: z.string().trim().max(4000).optional(),
  details: Details.optional(),
});

export const CertCatalogInput = z.object({
  catalogId: z.string().trim().min(1).max(40),
  displayName: z.string().trim().min(1).max(200),
  officialName: z.string().trim().max(200).optional(),
  defaultRecordType: z.string().trim().max(60).optional(),
  defaultCategory: z.string().trim().max(60).optional(),
  description: z.string().trim().max(1000).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
});
