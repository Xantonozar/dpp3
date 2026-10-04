import { z } from "zod";

const OtherField = z.object({
  code: z.string().trim().min(1).max(80),
  other: z.string().trim().max(200).optional(),
});

const FiberInput = z.object({
  fiberCode: z.string().trim().min(1).max(80),
  otherName: z.string().trim().max(120).optional(),
  percentage: z.number().min(0.0001).max(100),
});

const TrimInput = z.object({
  componentCode: z.string().trim().min(1).max(80),
  otherName: z.string().trim().max(120).optional(),
  materialType: z.string().trim().max(120).optional(),
});

export const MaterialsInput = z.object({
  fabricType: OtherField.optional(),
  fibers: z.array(FiberInput).max(10),
  gsm: z.number().min(0.0001).nullable().optional(),
  construction: z.string().trim().max(200).optional(),
  trims: z.array(TrimInput).max(60).optional().default([]),
  dataSource: z.string().trim().max(500).optional(),
});
