import mongoose, { Schema } from "mongoose";

const CertCatalogSchema = new Schema(
  {
    catalogId: { type: String, required: true, trim: true, maxlength: 40 },
    displayName: { type: String, trim: true, maxlength: 200 },
    officialName: { type: String, trim: true, maxlength: 200 },
    defaultRecordType: { type: String, trim: true, maxlength: 60 },
    defaultCategory: { type: String, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
CertCatalogSchema.index({ catalogId: 1 }, { unique: true });
CertCatalogSchema.index({ displayName: "text" });

const CertRecordSchema = new Schema(
  {
    catalogId: { type: String, required: true, trim: true, maxlength: 40 },
    recordType: {
      type: String,
      required: true,
      enum: ["Certification", "Audit/Assessment", "Programme", "Management System", "Legal/Statutory", "Product Test/Requirement"],
    },
    category: { type: String, trim: true, maxlength: 80 },
    applicableTo: { type: String, trim: true, maxlength: 80 },
    tierStage: { type: String, trim: true, maxlength: 120 },
    relatedEntityId: { type: Schema.Types.ObjectId, ref: "Facility" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    materialId: Schema.Types.ObjectId,
    batchId: { type: String, trim: true, maxlength: 120 },
    scopeText: { type: String, required: true, trim: true, maxlength: 4000 },
    documentNumber: { type: String, trim: true, maxlength: 200 },
    issuer: { type: String, trim: true, maxlength: 200 },
    issueDate: Date,
    // display-only: never changes status, no cron
    expiryDate: Date,
    noStatedExpiry: Boolean,
    assessmentDate: Date,
    reviewDate: Date,
    status: {
      type: String,
      default: "Verified",
      enum: ["Verified", "Not Assessed", "Not Applicable", "Rejected/Invalid"],
    },
    notApplicableReason: { type: String, trim: true, maxlength: 1000 },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    complianceOutcome: {
      type: String,
      enum: ["Not assessed", "Compliant", "Non-compliant", "Not applicable"],
    },
    requirementName: { type: String, trim: true, maxlength: 300 },
    requirementLimit: { type: String, trim: true, maxlength: 300 },
    evidenceType: { type: String, trim: true, maxlength: 80 },
    evidenceFile: { type: Schema.Types.ObjectId, ref: "Asset" },
    evidenceUrl: { type: String, trim: true, maxlength: 1000 },
    publicEvidenceApproved: { type: Boolean, default: false },
    verificationMethod: { type: String, trim: true, maxlength: 300 },
    remarks: { type: String, trim: true, maxlength: 4000 },
    details: {
      audit: {
        auditReference: String,
        auditResult: String,
        findings: String,
        remediation: String,
        followUpDate: Date,
      },
      programme: { participationId: String },
      legal: { authority: String, permitNumber: String, effectiveDate: Date },
      productTest: {
        testMethod: String,
        sampleRef: String,
        labName: String,
        resultValue: String,
        resultUnit: String,
        reportNumber: String,
        reportDate: Date,
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: Date,
  },
  { timestamps: true }
);

CertRecordSchema.index({ productId: 1, archivedAt: 1 });
CertRecordSchema.index({ archivedAt: 1 });
CertRecordSchema.index({ relatedEntityId: 1, catalogId: 1 });
CertRecordSchema.index({ status: 1, recordType: 1, archivedAt: 1 });
CertRecordSchema.index({ tierStage: 1, status: 1 });
// duplicate detection is a WARNING (non-unique index)
CertRecordSchema.index(
  { catalogId: 1, issuer: 1, documentNumber: 1, relatedEntityId: 1 },
  { partialFilterExpression: { documentNumber: { $type: "string", $gt: "" } } }
);
CertRecordSchema.index({ scopeText: "text", requirementName: "text", documentNumber: "text" });

export const CertCatalog =
  mongoose.models.CertCatalog || mongoose.model("CertCatalog", CertCatalogSchema);
export const CertRecord =
  mongoose.models.CertRecord || mongoose.model("CertRecord", CertRecordSchema);
