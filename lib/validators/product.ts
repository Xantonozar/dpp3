import { z } from "zod";

export const MAX_COLORS = 10;

const ColorImageInput = z.object({
  publicId: z.string().min(1).max(300).optional(),
  secureUrl: z.string().max(1000).optional(),
  altText: z.string().max(200).optional(),
  sortOrder: z.number().optional(),
});

const ColorInput = z.object({
  _id: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Color name is required").max(120),
  colorCode: z.string().trim().max(40).optional(),
  images: z.array(ColorImageInput).max(20).optional(),
  sortOrder: z.number().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const ProductCreate = z.object({
  productId: z.string().trim().min(1, "Product ID is required").max(60),
  styleNo: z.string().trim().max(60).optional(),
  name: z.string().trim().max(200).optional(),
  productType: z.string().trim().max(120).optional(),
  buyerBrand: z.string().trim().max(120).optional(),
  sizeSystemKey: z.string().trim().max(60).optional(),
});

export const ProductPatch = z.object({
  styleNo: z.string().trim().max(60).optional(),
  name: z.string().trim().max(200).optional(),
  productType: z.string().trim().max(120).optional(),
  buyerBrand: z.string().trim().max(120).optional(),
  sizeSystemKey: z.string().trim().max(60).optional(),
  resetVariants: z.boolean().optional(),
  colors: z.array(ColorInput).max(20).optional(),
  status: z.enum(["Draft", "Published", "Archived"]).optional(),
});

const GtinRow = z.object({
  colorId: z.string().min(1),
  sizeKey: z.string().trim().min(1).max(80),
  // trim only — never coerce to number, keeps leading zeros
  gtin: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  gtinStatus: z
    .enum(["Draft", "GTIN Pending", "Valid", "Invalid", "Archived"])
    .optional(),
});

export const VariantsSync = z.object({
  rows: z.array(GtinRow).max(500),
  final: z.boolean().optional().default(false),
});
