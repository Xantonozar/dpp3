import { z } from "zod";
import { PackagingInput } from "../validators/packaging";

export type PackagingData = z.infer<typeof PackagingInput>;

function err(message: string, status = 422) {
  return Object.assign(new Error(message), { status });
}

/** Full save validation. Throws 422. Never auto-sets recyclability. */
export function validatePackaging(input: PackagingData): {
  recycledContentPercent: number | null;
} {
  if (!input.packagingType?.code) throw err("Packaging type is required.");
  if (input.packagingType.code === "other" && !input.packagingType.other?.trim()) {
    throw err("Specify the packaging type when type is Other.");
  }
  if (!input.packagingMaterials || input.packagingMaterials.length === 0) {
    throw err("Select at least one packaging material.");
  }
  for (const m of input.packagingMaterials) {
    if (m.code === "other" && !m.other?.trim()) {
      throw err("Specify the material when material is Other.");
    }
  }
  if (!input.recyclability) throw err("Recyclability is required.");
  if (!input.disposalReuseInstructions?.trim()) {
    throw err("Disposal / reuse instructions are required.");
  }
  if (input.recycledContentStatus === "Provided") {
    const p = input.recycledContentPercent;
    if (p == null || !Number.isFinite(p)) {
      throw err("Enter the recycled content % (0–100) or choose Not Available.");
    }
    if (p < 0 || p > 100) throw err("Recycled content must be between 0 and 100.");
    return { recycledContentPercent: p };
  }
  return { recycledContentPercent: null };
}
