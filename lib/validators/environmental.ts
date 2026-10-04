import { z } from "zod";

export const EnvironmentalInput = z.object({
  garmentWeightKg: z.number().positive("Garment weight must be above 0."),
  cuttingUtilizationPct: z.number().min(0.0001).max(100),
  knittingKwhPerKg: z.number().min(0),
  dyeingKwhPerKg: z.number().min(0),
  fabricFinishingKwhPerKg: z.number().min(0),
  cuttingKwhPerGarment: z.number().min(0),
  sewingKwhPerGarment: z.number().min(0),
  garmentFinishingKwhPerGarment: z.number().min(0),
  gridSharePct: z.number().min(0).max(100),
  solarSharePct: z.number().min(0).max(100),
  dataSource: z.string().trim().max(500).optional(),
});

export const EmissionFactorInput = z.object({
  key: z.string().trim().min(1).max(80),
  type: z.enum(["grid", "solar"]),
  kgCo2ePerKwh: z.number().min(0),
  source: z.string().trim().min(1, "Source is required.").max(300),
  yearVersion: z.string().trim().min(1, "Year / version is required.").max(60),
  methodology: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export const EmissionFactorPatch = EmissionFactorInput.partial().extend({
  key: z.string().trim().min(1).max(80).optional(),
});
