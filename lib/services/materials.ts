import { z } from "zod";
import { MaterialsInput } from "../validators/materials";
import { calcComposition, canonicalFiber } from "../calc/composition";

export type MaterialsData = z.infer<typeof MaterialsInput>;

function err(message: string, status = 422) {
  return Object.assign(new Error(message), { status });
}

/**
 * Full server-side validation. Throws 422 on any rule violation.
 * `aliases` maps fiber code -> canonical code (from the fiber_type catalog;
 * elastane == spandex).
 */
export function validateMaterials(
  input: MaterialsData,
  aliases: Record<string, string> = { spandex: "elastane", elastane: "elastane" }
): { compositionTotal: number } {
  const { fibers, trims, fabricType, gsm } = input;

  if (!fibers || fibers.length === 0) {
    throw err("Add at least one fiber to describe the main fabric.");
  }
  for (const f of fibers) {
    if (!Number.isFinite(f.percentage) || f.percentage <= 0 || f.percentage > 100) {
      throw err(`Invalid percentage for ${f.fiberCode}: enter a value above 0 up to 100.`);
    }
    if (f.fiberCode === "other" && !f.otherName?.trim()) {
      throw err("Fiber name is required when fiber is Other.");
    }
  }
  const { total, valid } = calcComposition(fibers.map((f) => f.percentage));
  if (!valid) {
    throw err(
      total < 100
        ? `Composition totals ${total}% — must total 100% to save.`
        : `Composition totals ${total}% which exceeds 100% — must total 100% to save.`
    );
  }
  const seen = new Set<string>();
  for (const f of fibers) {
    const canon = canonicalFiber(f.fiberCode, aliases);
    if (seen.has(canon)) {
      throw err(`Duplicate fiber: ${f.fiberCode} is already listed (elastane and spandex count as one).`);
    }
    seen.add(canon);
  }
  if (fabricType?.code === "other" && !fabricType.other?.trim()) {
    throw err("Specify the fabric type when type is Other.");
  }
  if (gsm != null && !(gsm > 0)) {
    throw err("GSM must be a positive number.");
  }
  const trimSeen = new Set<string>();
  for (const t of (trims ?? [])) {
    if (t.componentCode === "other" && !t.otherName?.trim()) {
      throw err("Component name is required when component is Other.");
    }
    const k = `${t.componentCode}|||${(t.materialType ?? "").trim().toLowerCase()}`;
    if (trimSeen.has(k)) {
      throw err("That trim is already listed with the same material detail.");
    }
    trimSeen.add(k);
  }
  return { compositionTotal: total };
}
