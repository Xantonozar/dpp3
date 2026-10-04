import { dbConnect } from "../lib/db";
import { DropdownOption } from "../lib/models/DropdownOption";
import { SizeSystem } from "../lib/models/SizeSystem";
import { TestCatalog, Substance } from "../lib/models/Quality";
import { CertCatalog } from "../lib/models/Certification";

const GREY = "grey_scale_1_5";

type TestSeed = {
  testId: string;
  name: string;
  category: "colour" | "physical" | "mechanical";
  methods: { methodId: string; label: string; edition: string; editionVerified: boolean; note: string }[];
  applicability: string[];
  shortSummary: string;
  expandedSummary: string;
  resultSchema: { key: string; label: string; type: "grade" | "number" | "text" | "enum"; unit?: string; scale?: string; options?: string[]; required?: boolean }[];
};

// 12 tests (Quality guide §6 + Addendum). Method editions are unverified until
// the standards administrator confirms them. Summaries are starter text the
// administrator can refine; result fields follow Appendix B.
const TESTS: TestSeed[] = [
  {
    testId: "colour_washing", name: "Colour Fastness to Washing", category: "colour",
    methods: [{ methodId: "iso_105_c06", label: "ISO 105-C06", edition: "unverified", editionVerified: false, note: "Procedure and edition chosen by lab or buyer." }],
    applicability: ["dyed textile", "all garments"],
    shortSummary: "How much the colour changes and stains after washing.",
    expandedSummary: "A specimen is washed with adjacent fabrics under a chosen ISO 105-C06 procedure; colour change and staining are graded against the grey scale.",
    resultSchema: [
      { key: "colour_change", label: "Colour change grade", type: "grade", scale: GREY, required: true },
      { key: "staining", label: "Staining grade", type: "grade", scale: GREY },
      { key: "procedure", label: "Test procedure", type: "text" },
      { key: "wash_conditions", label: "Wash conditions", type: "text" },
    ],
  },
  {
    testId: "colour_perspiration", name: "Colour Fastness to Perspiration (Sweat)", category: "colour",
    methods: [{ methodId: "iso_105_e04", label: "ISO 105-E04 or buyer method", edition: "unverified", editionVerified: false, note: "Confirm edition and options." }],
    applicability: ["body-contact garments"],
    shortSummary: "Colour fastness to acidic and alkaline sweat, tested separately.",
    expandedSummary: "Specimens are treated with acidic and alkaline perspiration solutions, then colour change and staining are graded.",
    resultSchema: [
      { key: "condition", label: "Condition", type: "enum", options: ["Acidic", "Alkaline"], required: true },
      { key: "colour_change", label: "Colour change grade", type: "grade", scale: GREY, required: true },
      { key: "staining", label: "Staining grade", type: "grade", scale: GREY },
      { key: "method_edition", label: "Method / edition", type: "text" },
    ],
  },
  {
    testId: "colour_rubbing", name: "Colour Fastness to Rubbing", category: "colour",
    methods: [{ methodId: "iso_105_x12", label: "ISO 105-X12", edition: "unverified", editionVerified: false, note: "Confirm procedure." }],
    applicability: ["dyed textile"],
    shortSummary: "Dry and wet rubbing fastness.",
    expandedSummary: "A white rubbing cloth is rubbed against the specimen dry and wet; staining of the cloth is graded.",
    resultSchema: [
      { key: "dry_grade", label: "Dry grade", type: "grade", scale: GREY, required: true },
      { key: "wet_grade", label: "Wet grade", type: "grade", scale: GREY, required: true },
    ],
  },
  {
    testId: "colour_light", name: "Colour Fastness to Light", category: "colour",
    methods: [{ methodId: "iso_105_b02", label: "ISO 105-B02 or applicable method", edition: "unverified", editionVerified: false, note: "Confirm edition and exposure option." }],
    applicability: ["outerwear", "light-exposed garments"],
    shortSummary: "Rated on the Blue Wool scale 1–8, not the grey scale.",
    expandedSummary: "The specimen is exposed to artificial light alongside Blue Wool references; the rating follows the report-defined result.",
    resultSchema: [
      { key: "blue_wool", label: "Blue Wool rating", type: "grade", scale: "blue_wool_1_8", required: true },
      { key: "exposure", label: "Exposure method / option", type: "text" },
    ],
  },
  {
    testId: "colour_saliva", name: "Colour Fastness to Saliva", category: "colour",
    methods: [{ methodId: "din_53160", label: "DIN 53160-1 or buyer method", edition: "unverified", editionVerified: false, note: "Lab confirms suitability and edition." }],
    applicability: ["babywear", "childrenswear"],
    shortSummary: "Report-defined saliva fastness result.",
    expandedSummary: "Specimen treated with artificial saliva; colour change and staining reported per the lab method.",
    resultSchema: [
      { key: "result_text", label: "Reported result", type: "text", required: true },
      { key: "scale_used", label: "Scale", type: "text" },
      { key: "conditions", label: "Conditions", type: "text" },
    ],
  },
  {
    testId: "colour_hot_pressing", name: "Colour Fastness to Hot Pressing", category: "colour",
    methods: [{ methodId: "iso_105_x11", label: "ISO 105-X11 or buyer method", edition: "unverified", editionVerified: false, note: "Confirm condition and edition." }],
    applicability: ["pressed garments"],
    shortSummary: "Dry, damp and wet pressing fastness.",
    expandedSummary: "The specimen is hot-pressed dry, damp and/or wet; colour change and staining are graded.",
    resultSchema: [
      { key: "condition", label: "Condition", type: "enum", options: ["Dry", "Damp", "Wet"], required: true },
      { key: "colour_change", label: "Colour-change grade", type: "grade", scale: GREY, required: true },
      { key: "staining", label: "Staining grade", type: "grade", scale: GREY },
    ],
  },
  {
    testId: "tear_off_small_parts", name: "Tear-Off Force of Small Parts", category: "mechanical",
    methods: [{ methodId: "buyer_or_lab", label: "Applicable child-product standard, buyer protocol or lab method", edition: "unverified", editionVerified: false, note: "No universal ISO method or limit." }],
    applicability: ["babywear", "childrenswear", "trims"],
    shortSummary: "Force needed to tear off a small part, in newtons.",
    expandedSummary: "Small components are pulled per the buyer protocol or lab method; force, direction and requirement source are recorded.",
    resultSchema: [
      { key: "component", label: "Component / location", type: "text", required: true },
      { key: "force_n", label: "Force", type: "number", unit: "N", required: true },
      { key: "setup", label: "Test setup / direction", type: "text" },
    ],
  },
  {
    testId: "press_stud_opening", name: "Opening Force of Press Studs", category: "mechanical",
    methods: [{ methodId: "buyer_or_lab", label: "Applicable press-stud / buyer method", edition: "unverified", editionVerified: false, note: "Lab confirms setup." }],
    applicability: ["press studs", "snaps"],
    shortSummary: "Opening force of press studs, in newtons.",
    expandedSummary: "Studs are opened per the confirmed setup; opening force, fastener type and criterion source are recorded.",
    resultSchema: [
      { key: "force_n", label: "Opening force", type: "number", unit: "N", required: true },
      { key: "fastener", label: "Fastener location / type", type: "text" },
    ],
  },
  {
    testId: "zipper_strength", name: "Zipper Strength", category: "mechanical",
    methods: [{ methodId: "buyer_or_lab", label: "Applicable zipper standard or buyer protocol", edition: "unverified", editionVerified: false, note: "Configure exact method and property." }],
    applicability: ["zippers"],
    shortSummary: "Zipper property and force where applicable.",
    expandedSummary: "The configured zipper property is tested; force, location and criterion are recorded.",
    resultSchema: [
      { key: "property", label: "Property tested", type: "text", required: true },
      { key: "force_n", label: "Force", type: "number", unit: "N" },
      { key: "location", label: "Zipper location / type", type: "text" },
    ],
  },
  {
    testId: "abrasion", name: "Abrasion Resistance", category: "physical",
    methods: [{ methodId: "iso_12947", label: "ISO 12947 series (Martindale)", edition: "unverified", editionVerified: false, note: "Select part and endpoint." }],
    applicability: ["woven", "high-wear areas"],
    shortSummary: "Cycles to endpoint and/or appearance rating.",
    expandedSummary: "Martindale abrasion to the configured endpoint; cycles and appearance rating are recorded.",
    resultSchema: [
      { key: "cycles", label: "Cycles", type: "number", unit: "cycles", required: true },
      { key: "rating", label: "Appearance rating", type: "grade", scale: GREY },
      { key: "endpoint", label: "Endpoint", type: "text" },
    ],
  },
  {
    testId: "dimensional_stability", name: "Dimensional Stability to Washing", category: "physical",
    methods: [{ methodId: "iso_5077", label: "ISO 5077 with specified wash/dry procedure", edition: "unverified", editionVerified: false, note: "Configure the wash/dry combination." }],
    applicability: ["knits", "all garments"],
    shortSummary: "Signed length and width change in percent.",
    expandedSummary: "Measured length and width change after the specified wash/dry procedure; shrinkage is negative.",
    resultSchema: [
      { key: "length_pct", label: "Length change", type: "number", unit: "%", required: true },
      { key: "width_pct", label: "Width change", type: "number", unit: "%", required: true },
      { key: "procedure", label: "Wash / dry procedure", type: "text" },
    ],
  },
  {
    testId: "pilling", name: "Pilling Resistance", category: "physical",
    methods: [{ methodId: "iso_12945", label: "ISO 12945 series", edition: "unverified", editionVerified: false, note: "Select part/apparatus and assessment stage." }],
    applicability: ["knits", "fleece"],
    shortSummary: "Pilling grade and/or cycles.",
    expandedSummary: "Pilling tested to the configured method part and stage; grade and cycles are recorded.",
    resultSchema: [
      { key: "grade", label: "Pilling grade", type: "grade", scale: GREY, required: true },
      { key: "cycles", label: "Cycles", type: "number", unit: "cycles" },
    ],
  },
];

const SUBSTANCES: { key: string; name: string; isGroup: boolean; casNumbers: string[]; components: string[] }[] = [
  { key: "formaldehyde", name: "Formaldehyde", isGroup: false, casNumbers: ["50-00-0"], components: ["Fabric / garment"] },
  { key: "apeo", name: "APEO / NPEO", isGroup: true, casNumbers: [], components: ["Wet processing"] },
  { key: "heavy_metals", name: "Extractable heavy metals", isGroup: true, casNumbers: [], components: ["Dyes, pigments, trims"] },
  { key: "pfas", name: "PFAS", isGroup: true, casNumbers: [], components: ["Functional finishes"] },
  { key: "phthalates", name: "Phthalates", isGroup: true, casNumbers: [], components: ["Print / plasticized parts"] },
  { key: "azo", name: "Azo colourants / restricted aromatic amines", isGroup: true, casNumbers: [], components: ["Dyed textile"] },
  { key: "pah", name: "PAHs", isGroup: true, casNumbers: [], components: ["Rubber / plastic"] },
  { key: "organotin", name: "Organotin compounds", isGroup: true, casNumbers: [], components: ["Applicable coatings/components"] },
  { key: "chlorinated_phenols", name: "Chlorinated phenols (e.g. PCP)", isGroup: true, casNumbers: ["87-86-5"], components: ["Textiles"] },
  { key: "dmf", name: "DMF", isGroup: false, casNumbers: ["68-12-2"], components: ["Certain coated materials"] },
  { key: "chlorinated_paraffins", name: "Chlorinated paraffins", isGroup: true, casNumbers: [], components: ["Applicable plastic/rubber"] },
];

const CERTS: { catalogId: string; displayName: string; officialName: string; defaultRecordType: string; defaultCategory: string; description: string }[] = [
  { catalogId: "01", displayName: "LEED Gold", officialName: "LEED Gold", defaultRecordType: "Certification", defaultCategory: "Environmental", description: "Green building certification at Gold level." },
  { catalogId: "02", displayName: "BCI / Better Cotton", officialName: "Better Cotton Initiative", defaultRecordType: "Programme", defaultCategory: "Material/Product", description: "Better Cotton sourcing programme." },
  { catalogId: "03", displayName: "GOTS", officialName: "Global Organic Textile Standard", defaultRecordType: "Certification", defaultCategory: "Material/Product", description: "Organic textile processing standard." },
  { catalogId: "04", displayName: "OCS", officialName: "Organic Content Standard", defaultRecordType: "Certification", defaultCategory: "Material/Product", description: "Organic content chain-of-custody standard." },
  { catalogId: "05", displayName: "RCS", officialName: "Recycled Claim Standard", defaultRecordType: "Certification", defaultCategory: "Material/Product", description: "Recycled content chain-of-custody standard." },
  { catalogId: "06", displayName: "GRS", officialName: "Global Recycled Standard", defaultRecordType: "Certification", defaultCategory: "Material/Product", description: "Recycled content with social and environmental criteria." },
  { catalogId: "07", displayName: "Fairtrade", officialName: "Fairtrade (scheme-specific)", defaultRecordType: "Certification", defaultCategory: "Social/Labour", description: "Fairtrade certification — record the exact scheme name and scope." },
  { catalogId: "08", displayName: "OEKO-TEX STANDARD 100", officialName: "OEKO-TEX STANDARD 100", defaultRecordType: "Certification", defaultCategory: "Safety", description: "Product safety testing for harmful substances." },
  { catalogId: "09", displayName: "ISO 9001:2015", officialName: "ISO 9001:2015", defaultRecordType: "Management System", defaultCategory: "Quality", description: "Quality management system." },
  { catalogId: "10", displayName: "International Accord / RSC", officialName: "International Accord / RMG Sustainability Council", defaultRecordType: "Programme", defaultCategory: "Safety", description: "Workplace safety programme for garment factories." },
  { catalogId: "11", displayName: "amfori BSCI", officialName: "amfori BSCI", defaultRecordType: "Audit/Assessment", defaultCategory: "Social/Labour", description: "Social compliance audit programme." },
  { catalogId: "12", displayName: "Sedex / SMETA", officialName: "Sedex / SMETA", defaultRecordType: "Audit/Assessment", defaultCategory: "Social/Labour", description: "Sedex membership is a Programme record; a SMETA audit is a separate Audit/Assessment record." },
  { catalogId: "13", displayName: "Better Work Bangladesh", officialName: "Better Work Bangladesh", defaultRecordType: "Programme", defaultCategory: "Social/Labour", description: "ILO/IFC factory improvement programme." },
  { catalogId: "14", displayName: "RMG Sustainability Council (RSC)", officialName: "RMG Sustainability Council", defaultRecordType: "Programme", defaultCategory: "Safety", description: "Bangladesh RMG safety monitoring body." },
  { catalogId: "15", displayName: "CTPAT", officialName: "Customs Trade Partnership Against Terrorism", defaultRecordType: "Programme", defaultCategory: "Security", description: "Supply-chain security programme." },
  { catalogId: "16", displayName: "WRAP", officialName: "Worldwide Responsible Accredited Production", defaultRecordType: "Certification", defaultCategory: "Social/Labour", description: "Factory social compliance certification." },
];

type Opt = {
  code: string;
  label: string;
  aliasOf?: string;
  requiresSpecify?: boolean;
};

export const LISTS: Record<string, Opt[]> = {
  fabric_type: [
    { code: "single_jersey", label: "Single Jersey" },
    { code: "rib", label: "Rib" },
    { code: "interlock", label: "Interlock" },
    { code: "pique", label: "Pique" },
    { code: "fleece", label: "Fleece" },
    { code: "french_terry", label: "French Terry" },
    { code: "woven_plain", label: "Woven Plain Weave" },
    { code: "woven_twill", label: "Woven Twill" },
    { code: "woven_satin", label: "Woven Satin" },
    { code: "denim", label: "Denim" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  fiber_type: [
    { code: "cotton", label: "Cotton" },
    { code: "organic_cotton", label: "Organic Cotton" },
    { code: "recycled_cotton", label: "Recycled Cotton" },
    { code: "polyester", label: "Polyester" },
    { code: "recycled_polyester", label: "Recycled Polyester" },
    { code: "elastane", label: "Elastane (Spandex)", aliasOf: "elastane" },
    { code: "spandex", label: "Spandex", aliasOf: "elastane" },
    { code: "nylon", label: "Nylon / Polyamide" },
    { code: "viscose", label: "Viscose" },
    { code: "modal", label: "Modal" },
    { code: "lyocell", label: "Lyocell" },
    { code: "acetate", label: "Acetate" },
    { code: "linen", label: "Linen / Flax" },
    { code: "wool", label: "Wool" },
    { code: "silk", label: "Silk" },
    { code: "acrylic", label: "Acrylic" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  trim_component: [
    { code: "sewing_thread", label: "Sewing Thread" },
    { code: "main_label", label: "Main Label" },
    { code: "care_label", label: "Care Label" },
    { code: "size_label", label: "Size Label" },
    { code: "hangtag", label: "Hangtag" },
    { code: "button", label: "Button" },
    { code: "zipper", label: "Zipper" },
    { code: "snap", label: "Snap / Fastener" },
    { code: "drawcord", label: "Drawcord" },
    { code: "elastic", label: "Elastic" },
    { code: "interlining", label: "Interlining" },
    { code: "embroidery", label: "Embroidery" },
    { code: "print", label: "Print" },
    { code: "applique", label: "Applique" },
    { code: "shoulder_tape", label: "Shoulder Tape" },
    { code: "waistband", label: "Waistband" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  yarn_type: [
    { code: "ring_spun", label: "Ring Spun" },
    { code: "open_end", label: "Open End / Rotor Spun" },
    { code: "compact", label: "Compact Spun" },
    { code: "air_jet", label: "Air-Jet Spun" },
    { code: "other", label: "Other", requiresSpecify: true },
    { code: "unknown", label: "Unknown" },
  ],
  printing_status: [
    { code: "performed", label: "Performed" },
    { code: "not_performed", label: "Not performed" },
    { code: "unknown", label: "Unknown" },
  ],
  packaging_type: [
    { code: "polybag", label: "Individual Polybag" },
    { code: "paper", label: "Paper Packaging" },
    { code: "carton", label: "Carton Packaging" },
    { code: "reusable", label: "Reusable Packaging" },
    { code: "polybag_carton", label: "Polybag + Carton" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  packaging_material: [
    { code: "ldpe", label: "LDPE" },
    { code: "hdpe", label: "HDPE" },
    { code: "pp", label: "PP" },
    { code: "paper", label: "Paper" },
    { code: "cardboard", label: "Corrugated Cardboard" },
    { code: "recycled_plastic", label: "Recycled Plastic" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  recyclability: [
    { code: "recyclable", label: "Recyclable" },
    { code: "non_recyclable", label: "Non-recyclable" },
    { code: "conditional", label: "Conditionally Recyclable" },
    { code: "reusable", label: "Reusable" },
    { code: "not_available", label: "Not Available" },
  ],
  record_type: [
    { code: "certification", label: "Certification" },
    { code: "audit", label: "Audit/Assessment" },
    { code: "programme", label: "Programme" },
    { code: "management_system", label: "Management System" },
    { code: "legal", label: "Legal/Statutory" },
    { code: "product_test", label: "Product Test/Requirement" },
  ],
  category: [
    { code: "material_product", label: "Material/Product" },
    { code: "environmental", label: "Environmental" },
    { code: "quality", label: "Quality" },
    { code: "social", label: "Social/Labour" },
    { code: "safety", label: "Safety" },
    { code: "security", label: "Security" },
    { code: "legal", label: "Legal" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  applicable_to: [
    { code: "facility", label: "Facility" },
    { code: "building", label: "Building" },
    { code: "fibre", label: "Fibre" },
    { code: "yarn", label: "Yarn" },
    { code: "fabric", label: "Fabric" },
    { code: "process", label: "Process" },
    { code: "garment", label: "Garment/Product" },
    { code: "claim", label: "Supply-chain claim" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  tier_stage: [
    { code: "tier1", label: "Tier 1 (cutting, sewing/garment finishing)" },
    { code: "tier2", label: "Tier 2 (knitting, dyeing, fabric finishing)" },
    { code: "tier3", label: "Tier 3 yarn" },
    { code: "tier4", label: "Tier 4 fibre" },
    { code: "facility", label: "Whole facility" },
    { code: "product", label: "Finished product" },
  ],
  evidence_type: [
    { code: "certificate", label: "Certificate" },
    { code: "audit", label: "Audit" },
    { code: "lab_report", label: "Lab report" },
    { code: "permit", label: "Permit" },
    { code: "url", label: "Official URL" },
    { code: "other", label: "Other", requiresSpecify: true },
  ],
  verification_method: [
    { code: "document_review", label: "Document review" },
    { code: "issuer_lookup", label: "Issuer lookup" },
    { code: "third_party_audit", label: "Third-party audit" },
    { code: "lab_review", label: "Lab report review" },
    { code: "owner_confirmation", label: "Owner confirmation" },
    { code: "not_verified", label: "Not verified" },
  ],
  country: [
    { code: "BD", label: "Bangladesh" },
    { code: "CN", label: "China" },
    { code: "IN", label: "India" },
    { code: "VN", label: "Vietnam" },
    { code: "TR", label: "Türkiye" },
    { code: "PT", label: "Portugal" },
    { code: "KH", label: "Cambodia" },
    { code: "PK", label: "Pakistan" },
    { code: "DE", label: "Germany" },
    { code: "US", label: "United States" },
    { code: "GB", label: "United Kingdom" },
  ],
};

const SIZE_SYSTEMS = [
  {
    key: "alpha",
    name: "Standard Alpha",
    options: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  },
  {
    key: "eu_numeric",
    name: "European Numeric",
    options: ["36/38", "40/42", "44/46", "48/50", "52/54"],
  },
  {
    key: "babywear",
    name: "Babywear",
    options: ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M"],
  },
];

export async function seed() {
  await dbConnect();
  let dropdowns = 0;
  for (const [list, opts] of Object.entries(LISTS)) {
    for (const [i, o] of opts.entries()) {
      await DropdownOption.findOneAndUpdate(
        { list, code: o.code },
        {
          $set: {
            label: o.label,
            aliasOf: o.aliasOf ?? undefined,
            requiresSpecify: o.requiresSpecify ?? false,
            sortOrder: i,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      dropdowns++;
    }
  }
  let systems = 0;
  for (const s of SIZE_SYSTEMS) {
    await SizeSystem.findOneAndUpdate(
      { key: s.key },
      {
        $set: {
          name: s.name,
          options: s.options.map((label, i) => ({
            key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            label,
            sortOrder: i,
            active: true,
          })),
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    systems++;
  }
  // NOTE: emission factors and cert catalogs are never seeded. Emission factor
  // values, demo products and demo certification records stay out of every DB.
  // Test catalogs + starter substances seed here (admin extendable).
  let tests = 0;
  for (const t of TESTS) {
    await TestCatalog.findOneAndUpdate(
      { testId: t.testId },
      { $set: { ...t } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    tests++;
  }
  let substances = 0;
  for (const s of SUBSTANCES) {
    await Substance.findOneAndUpdate(
      { key: s.key },
      { $set: { ...s } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    substances++;
  }
  // 16 certification options (stable IDs; admin extendable). No records seeded.
  let certs = 0;
  for (const c of CERTS) {
    await CertCatalog.findOneAndUpdate(
      { catalogId: c.catalogId },
      { $set: { ...c } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    certs++;
  }
  return { ok: true, dropdowns, systems, tests, substances, certs };
}

const isMain = process.argv[1]?.endsWith("seed.ts");
if (isMain) {
  seed().then(
    (r) => {
      console.log(JSON.stringify(r));
      process.exit(0);
    },
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}
