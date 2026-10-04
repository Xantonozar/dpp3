import { z } from "zod";

const FacilityGroupInput = z.object({
  name: z.string().max(200).optional().default(""),
  location: z.string().max(200).optional().default(""),
  processes: z.array(z.string()).optional().default([]),
  processStatus: z.enum(["Assigned", "Unknown", "Not disclosed"]).optional().default("Assigned"),
});

const YarnCardInput = z.object({
  name: z.string().max(200).optional().default(""),
  location: z.string().max(200).optional().default(""),
  country: z.string().max(120).optional().default(""),
  yarnType: z.string().max(80).optional(),
  yarnCount: z.string().max(60).optional(),
  composition: z.string().max(200).optional(),
  referenceLot: z.string().max(120).optional(),
});

// Save Draft allows missing fields — shape only, no required checks.
export const TraceabilityInput = z.object({
  mode: z.enum(["draft", "final"]).optional().default("draft"),
  originDestination: z
    .object({
      countryOfManufacture: z.string().max(120).optional().default(""),
      finalFactory: z.string().max(200).optional().default(""),
      finalFactoryLocation: z.string().max(200).optional().default(""),
      destinationCountry: z.string().max(120).optional().default(""),
      destinationMarket: z.string().max(120).optional().default(""),
      buyerBrand: z.string().max(120).optional().default(""),
    })
    .optional()
    .default({}),
  tier1: z
    .object({
      arrangement: z.enum(["same", "different", "mixed"]).optional(),
      facilities: z.array(FacilityGroupInput).max(20).optional().default([]),
    })
    .optional()
    .default({}),
  tier2: z
    .object({
      arrangement: z.enum(["same", "different", "mixed"]).optional(),
      printingStatus: z.enum(["Performed", "Not performed", "Unknown"]).optional(),
      facilities: z.array(FacilityGroupInput).max(20).optional().default([]),
    })
    .optional()
    .default({}),
  tier3: z
    .object({
      yarnManufacturers: z.array(YarnCardInput).max(20).optional().default([]),
    })
    .optional()
    .default({}),
  dataSource: z.string().trim().max(500).optional(),
});
