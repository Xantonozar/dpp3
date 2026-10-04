export type TourStep = {
  element: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

// Tour of the products dashboard (first run / "I forgot how to start").
export const LIST_TOUR: TourStep[] = [
  {
    element: '[data-tour="page-header"]',
    title: "Welcome to Garment DPP",
    description:
      "This 60-second tour shows how products are created and opened. You can replay it any time from Help in the sidebar.",
    side: "bottom",
  },
  {
    element: '[data-tour="new-product"]',
    title: "Create a product",
    description:
      "Start with + New product — just an ID (like TSH-001), a name and a style number. Everything else is added on the product page.",
    side: "bottom",
  },
  {
    element: '[data-tour="setup-checklist"]',
    title: "One-time setup",
    description:
      "Before entering full data, add RSL profiles and emission factors from these links. The checklist disappears once both are ready.",
    side: "bottom",
  },
  {
    element: '[data-tour="search"]',
    title: "Find anything fast",
    description: "Search by ID, name or style, and filter the list by Draft, Published or Archived status.",
    side: "bottom",
  },
  {
    element: '[data-tour="product-card"]',
    title: "Open your product",
    description:
      "Each card shows colors and status. Open → takes you into the passport editor: 8 sections from Variants to Review & Publish.",
    side: "left",
  },
  {
    element: '[data-tour="console-nav"]',
    title: "Admin console",
    description:
      "Products, Catalogs, Emission factors, Quality catalogs — plus Help, the full manual with troubleshooting.",
    side: "right",
  },
];

// Tour of a single product page (auto first time a product is opened).
export const PRODUCT_TOUR: TourStep[] = [
  {
    element: '[data-tour="product-header"]',
    title: "Product header",
    description: "Name, ID, style and current status. Use ← Products to return to the list.",
    side: "bottom",
  },
  {
    element: '[data-tour="section-nav"]',
    title: "Jump between sections",
    description:
      "Eight anchored sections — click any chip to scroll straight there. Save each section at its own bottom; this bar stays pinned while you scroll.",
    side: "bottom",
  },
  {
    element: "#sec-variants",
    title: "Work top to bottom",
    description:
      "01 Variants (colors, sizes, GTINs) and 02 Materials must be 100% complete before publishing — the other sections add depth.",
    side: "right",
  },
  {
    element: "#sec-review",
    title: "Publish when ready",
    description:
      "08 Review lists every requirement. When all dots are green, publish to make the QR live — then download it under QR Code.",
    side: "top",
  },
];

// Per-section mini-tours: every section/sub-section "?" starts one.
// Steps are NOT pre-filtered — closed sub-sections open as the tour reaches
// them (TourProvider auto-clicks their header), so later steps render in time.
export const SECTION_TOURS: Record<string, TourStep[]> = {
  variants: [
    { element: "#variants", title: "1. Product Variants", side: "right",
      description: "Colors, sizes and GTINs live here. Work through the sub-sections top to bottom — each saves on its own at the bottom." },
    { element: "#variants-system", title: "1.1 Size system", side: "right",
      description: "Pick the size system first. Changing it later archives existing colors/sizes (confirm Reset or Cancel) — sizes are never mapped automatically." },
    { element: "#variants-colors", title: "1.2 Colors & images", side: "right",
      description: "Add colors with images and hex. The first image becomes the passport photo on the public page." },
    { element: "#variants-gtin", title: "1.3 GTIN mapping", side: "right",
      description: "Tick sizes per color, then enter GTINs exactly as issued — never generated, leading zeros kept, duplicates across active variants rejected." },
    { element: "#variants-summary", title: "1.4 Summary", side: "right",
      description: "Live counts: active variants and how many still miss a GTIN." },
  ],
  materials: [
    { element: "#materials", title: "2. Materials & Composition", side: "right",
      description: "Fiber composition for the passport. The public page shows exactly what you save here." },
    { element: "#materials-fabric", title: "2.1 Main fabric", side: "right",
      description: "Fibers must total 100 ±0.01 to save. Elastane and spandex are one fiber; “Other” needs a specify note. The Total line turns green only when valid." },
    { element: "#materials-trims", title: "2.2 Trims & accessories", side: "right",
      description: "Buttons, labels, thread and other trims — optional rows with their own composition." },
  ],
  traceability: [
    { element: "#traceability", title: "3. Traceability", side: "right",
      description: "Where the garment is made, tier by tier. Missing tiers publish as “Unknown / Not disclosed”." },
    { element: "#trc-origin", title: "A. Origin & destination", side: "right",
      description: "Country of manufacture + final factory — this drives the “Made in” tile on the public passport." },
    { element: "#trc-tier1", title: "B. Tier 1 — garment", side: "right",
      description: "The sewing/finishing facility: factory name, location, optional note." },
    { element: "#trc-tier2", title: "C. Tier 2 — fabric", side: "right",
      description: "Fabric processing facility — same fields as tier 1." },
    { element: "#trc-tier3", title: "D. Tier 3 — yarn", side: "right",
      description: "Yarn manufacturing plus yarn lots with reference lots so batches can be traced." },
    { element: "#trc-summary", title: "E. Manufacturing summary", side: "right",
      description: "Review the whole chain in one place before publishing." },
  ],
  quality: [
    { element: "#quality", title: "4. Quality & Lab Testing", side: "right",
      description: "Lab results with verdicts. Results freeze on save — to re-evaluate, delete the row and enter it again." },
    { element: "#quality-facility", title: "4.1 Testing facility", side: "right",
      description: "Who performed the tests: facility details and its certification scope." },
    { element: "#quality-chemicals", title: "4.2 Chemical results", side: "right",
      description: "Restricted-substance results. Select the RSL profile BEFORE saving — key and unit must match, or the verdict stays REVIEW REQUIRED." },
    { element: "#quality-testing", title: "4.3 Physical tests", side: "right",
      description: "Colour fastness, physical and mechanical tests — PASS/FAIL comes from the selected profile's criteria (Blue Wool 1–8 for light fastness, grey 1–5 otherwise)." },
  ],
  packaging: [
    { element: "#care", title: "5. Care & Circularity", side: "right",
      description: "Care guidance plus packaging — both optional but shown on the passport when saved." },
    { element: "#pkg-51", title: "5.1 Packaging & disposal", side: "right",
      description: "Packaging type, materials, recycled content, recyclability and consumer disposal instructions." },
  ],
  environment: [
    { element: "#environmental", title: "6. Environmental Impact", side: "right",
      description: "Energy and carbon per garment. Carbon only computes when emission factors exist with source and year." },
    { element: "#env-inputs", title: "6.1 Inputs", side: "right",
      description: "Grid + solar shares must total exactly 100%. Data source documents where the numbers come from." },
    { element: "#env-energy", title: "6.2 Energy results", side: "right",
      description: "kWh per garment derived from your inputs — shown as the “total energy” on the public page." },
    { element: "#env-carbon", title: "6.3 Carbon footprint", side: "right",
      description: "kg CO₂e per garment. Needs active grid AND solar factors (value + source + year) in Admin → Emission factors." },
    { element: "#env-how", title: "6.4 How was it calculated?", side: "right",
      description: "The full 7-step math — the same explanation consumers see when they expand it on the public page." },
  ],
  certification: [
    { element: "#certification", title: "7. Certification & Compliance", side: "right",
      description: "Facility and product certificates. UI delete = archive; counters exclude archived records." },
    { element: "#cert-overview", title: "7.1 Certification overview", side: "right",
      description: "Headline counts of active certificates at a glance." },
    { element: "#comp-overview", title: "7.2 Compliance overview", side: "right",
      description: "Compliance status across records — “Compliant” requires requirement name + assessment date." },
    { element: "#cert-records", title: "7.3 Certification records", side: "right",
      description: "Certificates with scope, issue/expiry dates and evidence. Duplicate ID + issuer + site = warning, not a block. Facility certs always show scope text (no logos)." },
    { element: "#audit-records", title: "7.4 Audits & programmes", side: "right",
      description: "Audits, programmes, management systems, legal/statutory and product-test records." },
  ],
  review: [
    { element: "#review", title: "Publish readiness & QR", side: "left",
      description: "Every requirement with a live status dot — Variants (≥1) and Materials (100%) are mandatory; click a row to jump there. When all dots are green, Publish makes the QR live at /p/<code> (republish = same URL, version +1; unpublish = friendly 410)." },
  ],
  "emission-factors": [
    { element: '[data-tour="ef-header"]', title: "Emission factors", side: "bottom",
      description: "Nothing is seeded here — carbon cannot compute until you add both a grid and a solar factor with a documented source and year." },
    { element: '[data-tour="ef-form"]', title: "Add a factor", side: "bottom",
      description: "Type (grid/solar), value in kg CO₂e per kWh, source and year/version. Both types must exist before section 06 can calculate." },
    { element: '[data-tour="ef-list"]', title: "Saved factors", side: "top",
      description: "Editing a factor NEVER rewrites saved product records — values are snapshotted per publish. Recalculation happens only when you re-save the Environmental section." },
  ],
  "quality-catalogs": [
    { element: '[data-tour="qc-header"]', title: "Quality catalogs", side: "bottom",
      description: "The reference data behind every verdict: tests, substances and RSL profiles. Run npm run seed if the lists are empty." },
    { element: "#qc-tests", title: "Tests", side: "bottom",
      description: "12 seeded physical/chemical tests with methods and editions — deactivate what you don't use." },
    { element: "#qc-substances", title: "Substances", side: "bottom",
      description: "11 restricted substances with CAS numbers. Groups (“Multiple”) expand into their member CAS entries — never store “Multiple” itself." },
    { element: "#qc-rsl", title: "RSL profiles", side: "bottom",
      description: "Versioned buyer profiles. Each criterion's refKey and unit must EXACTLY match what a result enters, or the verdict stays REVIEW REQUIRED." },
  ],
  catalogs: [
    { element: '[data-tour="cat-header"]', title: "Catalogs", side: "bottom",
      description: "Every dropdown in the editor gets its options from here. Tests, substances and RSL live under Quality catalogs; carbon factors under Emission factors." },
    { element: '[data-tour="cat-picker"]', title: "Pick a list", side: "bottom",
      description: "15 lists (fabric, fiber, trims, packaging, countries, size systems…). Click one to load its options." },
    { element: '[data-tour="cat-options"]', title: "Options", side: "top",
      description: "Search, add and toggle options. Deactivate — never delete — so history and saved products keep their labels. Size systems are read-only (managed by scripts)." },
    { element: '[data-tour="cat-stds"]', title: "Certification standards", side: "top",
      description: "The standard catalog behind section 07 — add the standards your certificates reference, or deactivate ones you no longer hold." },
  ],
};
