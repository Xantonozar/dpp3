import { z } from "zod";

const OtherField = z.object({
  code: z.string().trim().min(1).max(80),
  other: z.string().trim().max(200).optional(),
});

export const PackagingInput = z.object({
  packagingType: OtherField,
  packagingMaterials: z.array(OtherField).min(1).max(20),
  recycledContentStatus: z.enum(["Provided", "Not Available"]).optional().default("Not Available"),
  recycledContentPercent: z.number().min(0).max(100).nullable().optional(),
  recyclability: z.enum([
    "Recyclable",
    "Non-recyclable",
    "Conditionally Recyclable",
    "Reusable",
    "Not Available",
  ]),
  disposalReuseInstructions: z.string().trim().min(1).max(4000),
  dataSource: z.string().trim().max(500).optional(),
});
