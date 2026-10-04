/** Shared composition math — used by both the UI live total and the server. */

export function calcComposition(percentages: number[]): {
  total: number;
  valid: boolean;
} {
  const sum = percentages.reduce((n, p) => n + (Number(p) || 0), 0);
  const total = Math.round(sum * 100) / 100;
  return { total, valid: Math.abs(total - 100) <= 0.01 };
}

/**
 * Canonical fiber code: elastane == spandex (and any future alias map
 * loaded from the fiber_type dropdown catalog).
 */
export function canonicalFiber(
  code: string,
  aliases: Record<string, string> = {}
): string {
  const c = code.trim().toLowerCase();
  return aliases[c] ?? c;
}
