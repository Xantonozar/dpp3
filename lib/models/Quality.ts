import mongoose, { Schema } from "mongoose";
import { recordMeta } from "./_shared";

const MethodSchema = new Schema(
  {
    methodId: String,
    label: String,
    edition: String,
    editionVerified: { type: Boolean, default: false },
    note: String,
  },
  { _id: false }
);

const ResultFieldSchema = new Schema(
  {
    key: String,
    label: String,
    type: { type: String, enum: ["grade", "number", "text", "enum"] },
    unit: String,
    scale: String,
    options: [String],
    required: Boolean,
  },
  { _id: false }
);

const TestCatalogSchema = new Schema(
  {
    testId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["colour", "physical", "mechanical"] },
    methods: { type: [MethodSchema], default: [] },
    applicability: [String],
    shortSummary: String,
    expandedSummary: String,
    resultSchema: { type: [ResultFieldSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
TestCatalogSchema.index({ testId: 1 }, { unique: true });
TestCatalogSchema.index({ name: "text" });

const SubstanceSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    name: String,
    isGroup: Boolean,
    // never store "Multiple" as a CAS
    casNumbers: [String],
    components: [String],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
SubstanceSchema.index({ key: 1 }, { unique: true });
SubstanceSchema.index({ name: "text" });
SubstanceSchema.index({ casNumbers: 1 });

const CriterionSchema = new Schema(
  {
    kind: { type: String, enum: ["test", "substance"] },
    refKey: String,
    operator: { type: String, enum: ["<=", "<", ">=", ">", "range"] },
    value: Number,
    valueMax: Number,
    unit: String,
    methodId: String,
  },
  { _id: false }
);

const RSLProfileSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    buyerProgram: String,
    source: String,
    version: { type: String, required: true, trim: true },
    effectiveDate: Date,
    market: String,
    ageGroup: String,
    productType: String,
    components: [String],
    criteria: { type: [CriterionSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
RSLProfileSchema.index({ key: 1, version: 1 }, { unique: true });
RSLProfileSchema.index({ market: 1, ageGroup: 1, active: 1 });

const LabReportSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    labName: { type: String, required: true, trim: true, maxlength: 200 },
    // string: keeps punctuation and leading zeros
    reportNumber: { type: String, required: true, trim: true, maxlength: 120 },
    overallResult: {
      type: String,
      enum: ["Pass", "Fail", "Conditional Pass", "Not Tested"],
      default: "Not Tested",
    },
    accreditation: {
      body: String,
      certificateRef: String,
      scopeRef: String,
      verified: { type: Boolean, default: false },
    },
    reviewedBy: String,
    reviewerDesignation: String,
    signOffDate: Date,
    reportFile: { type: Schema.Types.ObjectId, ref: "Asset" },
    ...recordMeta,
  },
  { timestamps: true }
);
LabReportSchema.index({ productId: 1, labName: 1, reportNumber: 1 }, { unique: true });

const TestResultSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    labReportId: { type: Schema.Types.ObjectId, ref: "LabReport" },
    kind: { type: String, enum: ["physical", "chemical"], required: true },
    testId: String,
    substanceKey: String,
    methodId: String,
    methodEdition: String,
    descriptionId: String,
    resultState: {
      type: String,
      enum: ["Value", "ND", "Not Tested", "Not Applicable", "Unknown"],
      default: "Value",
    },
    result: Schema.Types.Mixed,
    // ND: kept, never zero
    reportingLimit: Number,
    unit: String,
    scale: String,
    testDate: Date,
    sampleLocation: String,
    component: String,
    rslProfile: { key: String, version: String },
    // frozen copy of the rule used — never backfilled
    criterionSnapshot: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ["PASS", "FAIL", "REVIEW REQUIRED", "NOT TESTED", "NOT APPLICABLE"],
      default: "NOT TESTED",
    },
    published: { type: Boolean, default: false },
    ...recordMeta,
  },
  { timestamps: true }
);
TestResultSchema.index({ productId: 1, kind: 1, testId: 1 });
TestResultSchema.index({ productId: 1, kind: 1, substanceKey: 1 });
TestResultSchema.index({ labReportId: 1 });
TestResultSchema.index({ productId: 1, status: 1 });

export const TestCatalog =
  mongoose.models.TestCatalog || mongoose.model("TestCatalog", TestCatalogSchema);
export const Substance =
  mongoose.models.Substance || mongoose.model("Substance", SubstanceSchema);
export const RSLProfile =
  mongoose.models.RSLProfile || mongoose.model("RSLProfile", RSLProfileSchema);
export const LabReport =
  mongoose.models.LabReport || mongoose.model("LabReport", LabReportSchema);
export const TestResult =
  mongoose.models.TestResult || mongoose.model("TestResult", TestResultSchema);
