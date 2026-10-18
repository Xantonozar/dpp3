import { z } from "zod";

export const LabReportInput = z.object({
  labName: z.string().trim().min(1, "Lab name is required.").max(200),
  reportNumber: z.string().trim().min(1, "Report number is required.").max(120),
  overallResult: z.enum(["Pass", "Fail", "Conditional Pass", "Not Tested"]).optional().default("Not Tested"),
  accreditation: z
    .object({
      body: z.string().trim().max(200).optional(),
      certificateRef: z.string().trim().max(120).optional(),
      scopeRef: z.string().trim().max(120).optional(),
      verified: z.boolean().optional().default(false),
    })
    .optional(),
  reviewedBy: z.string().trim().max(200).optional(),
  reviewerDesignation: z.string().trim().max(200).optional(),
  signOffDate: z.string().max(30).optional(),
  // Cloudinary metadata from a direct browser upload (private, authenticated)
  reportFile: z
    .object({
      publicId: z.string().min(1).max(300),
      secureUrl: z.string().max(1000).optional(),
    })
    .optional(),
  dataSource: z.string().trim().max(500).optional(),
});

export const TestResultInput = z.object({
  kind: z.enum(["physical", "chemical"]),
  labReportId: z.string().max(40).optional(),
  testId: z.string().max(80).optional(),
  substanceKey: z.string().max(80).optional(),
  methodId: z.string().max(120).optional(),
  methodEdition: z.string().max(60).optional(),
  descriptionId: z.string().max(80).optional(),
  resultState: z.enum(["Value", "ND", "Not Tested", "Not Applicable", "Unknown"]).optional().default("Value"),
  result: z.record(z.string(), z.unknown()).optional().default({}),
  reportingLimit: z.number().positive().optional(),
  unit: z.string().max(40).optional(),
  scale: z.string().max(40).optional(),
  testDate: z.string().max(30).optional(),
  sampleLocation: z.string().max(200).optional(),
  component: z.string().max(200).optional(),
  // RSL profile selector only — limits are NEVER editable here
  rslProfile: z.object({ key: z.string().max(120), version: z.string().max(60) }).optional(),
  status: z.enum(["PASS", "FAIL", "REVIEW REQUIRED", "NOT TESTED", "NOT APPLICABLE", "NOT VERIFIED"]).optional(),
  requirementText: z.string().max(500).optional(),
  groupIndex: z.number().optional(),
  published: z.boolean().optional().default(false),
  dataSource: z.string().trim().max(500).optional(),
});

export const RslItemInput = z.object({
  substanceKey: z.string().max(80),
  name: z.string().max(200),
  requirementText: z.string().max(500),
  groupIndex: z.number().int().min(1).max(12),
  status: z.enum(["PASS", "FAIL", "NOT VERIFIED"]),
  published: z.boolean().optional().default(true),
});

export const RslBatchInput = z.object({
  items: z.array(RslItemInput),
});

export const RSLProfileInput = z.object({
  key: z.string().trim().min(1).max(120),
  buyerProgram: z.string().trim().max(200).optional(),
  source: z.string().trim().max(300).optional(),
  version: z.string().trim().min(1).max(60),
  effectiveDate: z.string().max(30).optional(),
  market: z.string().trim().max(120).optional(),
  ageGroup: z.string().trim().max(120).optional(),
  productType: z.string().trim().max(120).optional(),
  components: z.array(z.string().trim().max(120)).max(30).optional().default([]),
  criteria: z
    .array(
      z.object({
        kind: z.enum(["test", "substance"]),
        refKey: z.string().trim().min(1).max(80),
        operator: z.enum(["<=", "<", ">=", ">", "range"]),
        value: z.number(),
        valueMax: z.number().optional(),
        unit: z.string().trim().max(40),
        methodId: z.string().trim().max(120).optional(),
      })
    )
    .max(200)
    .optional()
    .default([]),
});
