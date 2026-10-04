export type SetupCounts = {
  rslProfiles: number;
  emissionFactors: number;
};

export type SetupItem = {
  key: "rsl" | "factors";
  label: string;
  why: string;
  href: string;
  cta: string;
  done: boolean;
};

// Pure summary of first-run setup: which background catalogs must exist
// before quality verdicts and carbon calculations can work.
export function summarizeSetup(counts: SetupCounts): { items: SetupItem[]; ready: boolean } {
  const items: SetupItem[] = [
    {
      key: "rsl",
      label: "RSL profiles",
      why: "Quality results need a profile with matching criteria to show PASS/FAIL instead of REVIEW REQUIRED.",
      href: "/admin/quality-catalogs#qc-rsl",
      cta: "Create a profile",
      done: counts.rslProfiles > 0,
    },
    {
      key: "factors",
      label: "Emission factors",
      why: "Section 06 Environment does not calculate carbon until factors carry a source and year.",
      href: "/admin/emission-factors",
      cta: "Add factors",
      done: counts.emissionFactors > 0,
    },
  ];
  return { items, ready: items.every((i) => i.done) };
}
