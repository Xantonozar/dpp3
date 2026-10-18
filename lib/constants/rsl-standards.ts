export type RslStandardItem = {
  id: number;
  key: string;
  name: string;
  requirement: string;
};

export const TOP_12_RSL_STANDARDS: readonly RslStandardItem[] = [
  {
    id: 1,
    key: "azo_dyes",
    name: "Azo dyes releasing carcinogenic aromatic amines (22 amines)",
    requirement: "≤30 mg/kg per amine (REACH Annex XVII, entry 43)",
  },
  {
    id: 2,
    key: "formaldehyde",
    name: "Formaldehyde",
    requirement:
      "Baby/child ≤16 mg/kg; skin contact ≤75 mg/kg; outerwear ≤300 mg/kg (OEKO-TEX, AFIRM)",
  },
  {
    id: 3,
    key: "heavy_metals",
    name: "Heavy metals (Pb, Cd, Hg, As, Cr(VI), Ni)",
    requirement:
      "Lead in accessories ≤500 mg/kg (EU) or ≤100 mg/kg in US children's products; Cadmium ≤100 mg/kg; Cr(VI) in leather ≤3 mg/kg; Nickel release ≤0.5 µg/cm²/week for metal parts touching skin",
  },
  {
    id: 4,
    key: "phthalates",
    name: "Phthalates (DEHP, DBP, BBP, DIBP, DINP, DIDP, DNOP)",
    requirement:
      "≤0.1% (1,000 mg/kg) in plasticised parts such as prints, PVC and coatings",
  },
  {
    id: 5,
    key: "pfas",
    name: "PFAS (PFOS, PFOA, C9–C14 PFCAs, PFHxA)",
    requirement:
      "PFOA ≤25 ppb; PFOS ≤1 µg/m²; PFHxA ≤25 ppb (sum), related substances ≤1,000 ppb",
  },
  {
    id: 6,
    key: "alkylphenols",
    name: "Alkylphenols and ethoxylates (NP/NPEO, OP/OPEO)",
    requirement:
      "NPE ≤0.01% (100 mg/kg) in washable textiles (REACH entry 46a); brands often require ≤10–100 mg/kg",
  },
  {
    id: 7,
    key: "chlorophenols",
    name: "Chlorophenols (PCP, TeCP, TCP) and chlorinated organic carriers",
    requirement:
      "PCP typically ≤0.5 mg/kg (≤0.05 mg/kg for baby); chlorobenzenes and chlorotoluenes ≤1 mg/kg",
  },
  {
    id: 8,
    key: "organotin",
    name: "Organotin compounds (TBT, DBT, TPhT)",
    requirement:
      "≤0.1% as tin in articles (REACH entry 20); OEKO-TEX: TBT ≤0.5 mg/kg, DBT ≤1 mg/kg",
  },
  {
    id: 9,
    key: "flame_retardants",
    name: "Flame retardants (TRIS, TEPA, PBB, PBDEs, SCCPs)",
    requirement:
      "Banned in skin-contact textiles (REACH entries 4, 7, 8); SCCPs controlled under POPs",
  },
  {
    id: 10,
    key: "disperse_dyes",
    name: "Allergenic and carcinogenic disperse dyes (about 20 listed, e.g. Disperse Blue 1/35/106/124, Orange 37/76)",
    requirement: "Not detected (typically <50 mg/kg)",
  },
  {
    id: 11,
    key: "pahs",
    name: "PAHs (8 REACH PAHs)",
    requirement:
      "≤1 mg/kg per PAH (0.5 mg/kg for toys and childcare), REACH entry 50",
  },
  {
    id: 12,
    key: "svhc",
    name: "SVHC (REACH Candidate List)",
    requirement:
      "≤0.1% w/w per article; communicate to customers on request and notify ECHA where required",
  },
] as const;

export type RslStatus = "PASS" | "FAIL" | "NOT VERIFIED";

export const RSL_STATUS_OPTIONS: readonly RslStatus[] = [
  "PASS",
  "FAIL",
  "NOT VERIFIED",
] as const;
