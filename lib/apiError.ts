export type FlatDetails = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | string | undefined>;
};

export type ErrorBody = {
  error?: string;
  details?: FlatDetails;
} | null | undefined;

/**
 * Builds a save-failure message that names the offending fields.
 * Route handlers return Zod's flattened `details.fieldErrors`, but callers
 * used to display only `error` — hiding WHERE the problem is. `labels` maps
 * technical keys (garmentWeightKg) to UI labels (Garment weight).
 * Never throws and never drops the base message.
 */
export function apiErrorMessage(
  body: ErrorBody,
  labels: Record<string, string> = {},
  fallback = "Save failed"
): string {
  const base = body?.error?.trim() || fallback;
  const details = body?.details;
  if (!details || typeof details !== "object") return base;
  const lines: string[] = [];
  const fields = details.fieldErrors;
  if (fields && typeof fields === "object") {
    for (const [key, issues] of Object.entries(fields)) {
      const list = (Array.isArray(issues) ? issues : [issues]).filter(Boolean);
      if (list.length === 0) continue;
      lines.push(`${labels[key] ?? key}: ${list.join("; ")}`);
    }
  }
  for (const f of details.formErrors ?? []) {
    if (f) lines.push(f);
  }
  if (lines.length === 0) return base;
  return `${base} — ${lines.join(" · ")}`;
}
