import { z } from "zod";
import { TraceabilityInput } from "../validators/traceability";

export const TIER1_PROCESSES = ["cutting", "sewing", "garment_finishing"] as const;
export const TIER2_PROCESSES = ["knitting", "dyeing", "printing", "fabric_finishing"] as const;

export type TraceabilityData = z.infer<typeof TraceabilityInput>;

function err(message: string, status = 422) {
  return Object.assign(new Error(message), { status });
}

export type FinalCheck = { warnings: string[] };

/**
 * Review & Save enforcement. Throws 422 on any blocking rule.
 * Returns non-blocking warnings (e.g. final-factory mismatch).
 */
export function validateTraceabilityFinal(input: TraceabilityData): FinalCheck {
  const warnings: string[] = [];
  const o = input.originDestination;

  if (!o.countryOfManufacture?.trim()) throw err("Country of manufacture is required.");
  if (!o.finalFactory?.trim()) throw err("Final factory is required.");
  if (!o.finalFactoryLocation?.trim()) throw err("Final factory location is required.");
  if (!o.destinationCountry?.trim()) throw err("Destination country is required (use “Not specified” if unknown).");

  checkTier("Tier 1", input.tier1, [...TIER1_PROCESSES], null);
  checkTier("Tier 2", input.tier2, [...TIER2_PROCESSES], input.tier2.printingStatus ?? null);

  const yarn = input.tier3.yarnManufacturers;
  if (yarn.length === 0) throw err("Add at least one yarn manufacturer (Tier 3).");
  for (const [i, y] of yarn.entries()) {
    const n = i + 1;
    if (!y.name.trim()) throw err(`Yarn manufacturer ${n}: name is required.`);
    if (!y.location.trim()) throw err(`Yarn manufacturer ${n}: location is required.`);
    if (!y.country.trim()) throw err(`Yarn manufacturer ${n}: country of origin is required.`);
  }

  // P4-T23: final factory should match the Tier 1 final finishing site (warning only)
  const finishing = input.tier1.facilities.find((g) =>
    g.processes.includes("garment_finishing")
  );
  if (
    finishing &&
    finishing.processStatus === "Assigned" &&
    finishing.name.trim().toLowerCase() !== o.finalFactory.trim().toLowerCase()
  ) {
    warnings.push(
      `Final factory “${o.finalFactory.trim()}” differs from the Tier 1 garment-finishing site “${finishing.name.trim()}” — make them match or confirm this is intended.`
    );
  }
  return { warnings };
}

function checkTier(
  label: string,
  tier: { arrangement?: string; facilities: { name: string; location: string; processes: string[]; processStatus: string }[] },
  fixed: readonly string[],
  printingStatus: string | null
) {
  if (!tier.arrangement) throw err(`${label}: choose how processes are performed (Same / Different / Mixed).`);
  const groups = tier.facilities.filter((g) => g.name.trim() || g.location.trim() || g.processes.length > 0);
  if (groups.length === 0) throw err(`${label}: add at least one facility.`);
  for (const [i, g] of groups.entries()) {
    if (!g.name.trim()) throw err(`${label} facility ${i + 1}: name is required (whitespace-only names are rejected).`);
    if (!g.location.trim()) throw err(`${label} facility ${i + 1}: location is required.`);
  }

  const assignable = printingStatus === "Not performed" ? fixed.filter((p) => p !== "printing") : [...fixed];
  const seen = new Map<string, number>();
  for (const g of groups) {
    for (const p of g.processes) {
      if (!fixed.includes(p)) throw err(`${label}: unknown process “${p}”.`);
      if (printingStatus === "Not performed" && p === "printing") {
        throw err(`${label}: printing is marked “Not performed”, so no facility may claim it.`);
      }
      seen.set(p, (seen.get(p) ?? 0) + 1);
    }
  }
  for (const [p, n] of seen) {
    if (n > 1) throw err(`${label}: “${p}” is assigned to more than one facility — each process assigned once.`);
  }
  for (const p of assignable) {
    if (p === "printing" && printingStatus === "Unknown") continue; // never counts as complete
    if (!seen.has(p)) {
      throw err(
        `${label}: “${p}” is not assigned — assign it to a facility or mark its group Unknown / Not disclosed before final save.`
      );
    }
  }

  // Unknown printing never counts as complete: it needs no group of its own.
  const distinct =
    printingStatus === "Unknown" ? assignable.filter((p) => p !== "printing") : assignable;
  if (tier.arrangement === "same" && groups.length !== 1) {
    throw err(`${label}: “Same factory” needs exactly one facility group (found ${groups.length}).`);
  }
  if (tier.arrangement === "different" && groups.length !== distinct.length) {
    throw err(
      `${label}: “Different factories” needs one group per process (${distinct.length} groups, found ${groups.length}).`
    );
  }
  if (tier.arrangement === "mixed" && groups.length < 2) {
    throw err(`${label}: “Mixed” needs at least two facility groups.`);
  }
  if (label === "Tier 2" && !printingStatus) {
    throw err("Tier 2: printing status is required (Performed / Not performed / Unknown).");
  }
}

export type ParsedTraceability = z.infer<typeof TraceabilityInput>;
