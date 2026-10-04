# Garment DPP: Complete Implementation and Build Plan

**Product:** Digital Product Passport (DPP) for garments, with a single-admin data-entry app (one `admin` role; anything the admin saves counts as verified) and a public, QR-accessible product page.
**Stack:** Next.js App Router, Node.js, MongoDB + Mongoose, Cloudinary, Auth.js, Zod, React Hook Form, Vitest, Playwright.
**Field and type reference:** `Garment_DPP_Complete_Specification.docx` (separate file).
**Source specs:** the 8 DPP developer guides (Variants, Materials, Traceability, Quality & Lab Testing + Test Method Addendum, Packaging, Environmental Impact, Certification & Compliance).

> **Source of truth:** the 8 developer-guide PDFs. Where this plan and a guide differ, the guide wins. Appendix A maps every guide requirement to a plan section and test; Appendix D lists plan items that no guide requires.

> Assumption: "prkler schema" was read as **Mongoose schema**. If Prisma was meant, the data model still applies but the syntax changes (and Prisma's MongoDB support is more limited).

This file merges the former *MERN + Next.js Implementation Plan* (architecture, schemas, indexes, APIs) and the *Phase-by-Phase Build Plan with Test Gates* into one document.

## How this document is organised

| Part | Content | Use it for |
|---|---|---|
| **Part I** | Architecture and technical reference (A1-A9) | Design decisions, schemas, indexes, APIs, access model, public page, collapsible UI |
| **Part II** | Phase-by-phase build plan, Phases 0-10, each with a Test Gate | What to build, in what order, and when a phase counts as done |
| **Part III** | Testing strategy, security, env vars, deployment, seed data, open questions (C1-C6) | Release readiness and decisions to confirm |

**Schedule:** Part II is the authoritative schedule (about 11 weeks for one developer; modules in Phases 2-8 can be split between two developers). It replaces the shorter 8-phase delivery table of the earlier plan.

## Contents

- [Part I: Architecture and Technical Reference](#part-i-architecture-and-technical-reference)
- [Part II: Phase-by-Phase Build Plan with Test Gates](#part-ii-phase-by-phase-build-plan-with-test-gates)
- [Part III: Testing, Security, Deployment and Open Questions](#part-iii-testing-security-deployment-and-open-questions)
- [Appendix A: Coverage matrix (8 guides to plan and tests)](#appendix-a-coverage-matrix-8-guides-to-plan-and-tests)
- [Appendix B: Test catalog seed table (12 tests)](#appendix-b-test-catalog-seed-table-12-tests)
- [Appendix C: Exact lists, labels and seed content from the guides](#appendix-c-exact-lists-labels-and-seed-content-from-the-guides)
- [Appendix D: Plan items not required by any guide](#appendix-d-plan-items-not-required-by-any-guide)

---

## Part I: Architecture and Technical Reference

### A1. Architecture

```
Browser (React Server + Client Components)
   |
Next.js App Router (Vercel / Node host)
   |-- app/(admin)/...        signed-in screens (role-based; login required)
   |-- app/p/[slug]/...       public consumer QR page (no auth, read-only snapshot)
   |-- app/api/...            Route Handlers (REST JSON)
   |-- lib/db, lib/models     Mongoose connection + schemas
   |-- lib/services           business logic (calc, status engines, publish)
   |
MongoDB Atlas  <-- Mongoose
Cloudinary     <-- signed direct upload from browser; only metadata stored in Mongo
```

Key decisions:

| Decision | Choice | Reason |
|---|---|---|
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) | One deploy, shared TypeScript types |
| Mutations | Route Handlers for REST + Server Actions for simple form saves | Keep one validation layer (Zod) used by both |
| One doc per module | Separate collection per DPP module, linked by `productId` | Independent status/verification per module, simpler permissions, small documents |
| Repeatable rows | **Embedded subdocuments** (fibers, trims, facility groups, yarn cards, colors) | Always read/written with parent; stable `_id` per subdocument |
| Variants | **Separate collection** | Many rows, GTIN uniqueness and archive/restore logic |
| Public QR page | Reads a **published snapshot** (`PublishedDpp`), not live drafts | Guarantees only approved fields are public; cacheable |
| Calculations | Server-side pure functions in `lib/calc`, recomputed on save | Single source of truth; UI shows live preview with the same function |
| Auth | Auth.js (NextAuth) credentials + JWT sessions; **one role: `admin`**; no sign-up or public accounts | Single-admin model: the admin adds, edits, deletes and publishes DPPs, so nobody else can change them. The public (consumer) only sees the QR/URL page. The Certification guide allows fewer roles for a small prototype |
| Validation | Zod schemas shared by client forms and API | Same rules both sides |
| Forms | React Hook Form + Zod resolver | Repeatable field arrays, inline errors |

---

### A2. Project Structure

```
dpp/
|-- app/
|   |-- (auth)/login/page.tsx
|   |-- (admin)/
|   |   |-- layout.tsx                      # sidebar: 01 Variants ... 07 Certification
|   |   |-- products/page.tsx               # product list
|   |   |-- products/[productId]/
|   |   |   |-- variants/page.tsx
|   |   |   |-- materials/page.tsx
|   |   |   |-- traceability/page.tsx
|   |   |   |-- quality/page.tsx            # 5.1 facility, 5.2 chemicals, 5.3 tests
|   |   |   |-- packaging/page.tsx          # Care & Circularity 6.5
|   |   |   |-- environmental/page.tsx
|   |   |   |-- certification/page.tsx
|   |   |   |-- review/page.tsx             # admin publishes / unpublishes
|   |   |-- admin/catalogs/...              # dropdowns, tests, RSL, emission factors, certs
|   |-- p/[code]/page.tsx                   # PUBLIC product page (QR/URL), open to anyone, collapsible sectors
|   |-- api/
|       |-- auth/[...nextauth]/route.ts
|       |-- products/route.ts
|       |-- products/[productId]/{variants,materials,traceability,packaging,environmental}/route.ts
|       |-- products/[productId]/quality/{reports,results}/route.ts
|       |-- certifications/route.ts , [id]/route.ts , [id]/verify/route.ts
|       |-- catalogs/[list]/route.ts
|       |-- cloudinary/sign/route.ts
|       |-- publish/[productId]/route.ts      # builds snapshot + shortCode + QR
|       |-- public/[code]/route.ts            # public read-only JSON (rate limited)
|-- components/ (ui/CollapsibleSection, ui/SectorNav, forms, FiberRows, ColorCard, FacilityGroupCard, TestCard, StatusBadge ...)
|-- lib/
|   |-- db.ts                # cached Mongoose connection
|   |-- models/*.ts          # all schemas (section A4)
|   |-- validators/*.ts      # Zod
|   |-- services/            # publish.ts, certStatus.ts, testEvaluator.ts, variants.ts
|   |-- calc/                # composition.ts, energy.ts
|   |-- cloudinary.ts
|   |-- auth.ts              # requireAdmin() guard
|-- scripts/seed.ts          # catalogs only (NO demo/mock data, NO emission factor values)
|-- middleware.ts            # blocks every non-public route unless a signed-in session exists
```

---

### A3. Core Setup Code

#### A3.1 Cached Mongoose connection (required for Next.js hot reload and serverless)

```ts
// lib/db.ts
import mongoose from "mongoose";
const URI = process.env.MONGODB_URI!;
let cached = (global as any).mongoose || ((global as any).mongoose = { conn: null, promise: null });

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  cached.promise ||= mongoose.connect(URI, { bufferCommands: false, maxPoolSize: 10 });
  cached.conn = await cached.promise;
  return cached.conn;
}
```

Model registration pattern (avoids "OverwriteModelError"):

```ts
export const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
```

#### A3.2 Shared schema fragments

```ts
// lib/models/_shared.ts
import { Schema, Types } from "mongoose";

// Used by Materials, Traceability, Packaging, Environmental, Quality.
// Single-admin model: a record the admin saves is treated as verified. No Draft/Complete/Verified state machine.
export const recordMeta = {
  dataSource:         { type: String, trim: true },                 // e.g. "Factory BOM / supplier declaration"
  createdBy:          { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy:          { type: Schema.Types.ObjectId, ref: "User" },
};

export const otherField = {               // "Other" + specify pattern
  code:  { type: String, required: true },
  other: { type: String, trim: true },    // required by Zod/validator when code === "other"
};
```

Rule: **admin save = verified.** There is no separate verifier, no `/verify` action and no Draft / Complete / Verified status. Validation still runs on save (for example, composition must total 100%), so an invalid record cannot be saved. PASS/FAIL on lab results is still computed by `testEvaluator` only when a valid criterion exists.

---

### A4. Mongoose Schemas and Indexes

All schemas use `{ timestamps: true }`. Business IDs (`productId`, `testId`, `catalogId`) are stable strings; display labels are stored separately from codes.

#### A4.1 Identity, auth, config

```ts
// User
const UserSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  name: String,
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin"], required: true, default: "admin" },   // single role: full control of DPP data and catalogs
  active: { type: Boolean, default: true },
}, { timestamps: true });
UserSchema.index({ email: 1 }, { unique: true });

// DropdownOption: generic configurable lists (fabric_type, fiber_type, trim_component,
// packaging_type, packaging_material, recyclability, yarn_type, record_type, category,
// applicable_to, tier_stage, evidence_type, verification_method, country ...)
const DropdownOptionSchema = new Schema({
  list: { type: String, required: true },          // "fabric_type"
  code: { type: String, required: true },          // "single_jersey"
  label: { type: String, required: true },         // "Single Jersey"
  aliasOf: String,                                 // elastane <-> spandex canonical mapping
  requiresSpecify: { type: Boolean, default: false }, // true for "other"
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },        // deactivate, never delete (history)
}, { timestamps: true });
DropdownOptionSchema.index({ list: 1, code: 1 }, { unique: true });
DropdownOptionSchema.index({ list: 1, active: 1, sortOrder: 1 });   // dropdown fetch

// SizeSystem (alpha, eu_numeric, babywear; admin extendable)
const SizeSystemSchema = new Schema({
  key: { type: String, required: true },
  name: String,
  options: [{ key: String, label: String, sortOrder: Number, active: { type: Boolean, default: true } }],
  active: { type: Boolean, default: true },
}, { timestamps: true });
SizeSystemSchema.index({ key: 1 }, { unique: true });
```

#### A4.2 Product, colors, variants (Module 1)

```ts
const ColorSchema = new Schema({            // _id = colorVariantId (stable, not array index)
  name: { type: String, required: true, trim: true },
  colorCode: String,
  images: [{ asset: { type: Schema.Types.ObjectId, ref: "Asset" }, altText: String, sortOrder: { type: Number, default: 0 } }],   // ColorImage: file, sortOrder, altText
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "archived"], default: "active" },
});

const ProductSchema = new Schema({
  productId: { type: String, required: true },        // "TSH-001"
  styleNo: String,
  name: String,
  productType: String,                                // "Knitted T-shirt"
  buyerBrand: String,
  sizeSystemKey: { type: String },
  colors: [ColorSchema],
  status: { type: String, enum: ["Draft", "Published", "Archived"], default: "Draft" },   // Published on/off switch for the public QR page
  publishedSlug: String,
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
ProductSchema.index({ productId: 1 }, { unique: true });
ProductSchema.index({ publishedSlug: 1 }, { unique: true, sparse: true });
ProductSchema.index({ status: 1, updatedAt: -1 });
ProductSchema.index({ name: "text", styleNo: "text", productId: "text" });   // product search

const VariantSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  colorId:   { type: Schema.Types.ObjectId, required: true },     // ColorSchema._id
  sizeKey:   { type: String, required: true },                    // "alpha_m"
  gtin:      { type: String, trim: true },                        // STRING: keeps leading zeros
  gtinStatus:{ type: String, enum: ["Draft", "GTIN Pending", "Valid", "Invalid", "Archived"], default: "GTIN Pending" },
  active:    { type: Boolean, default: true },
  archivedAt: Date,
  archivedGtin: String,                                           // restore on re-select
}, { timestamps: true });

// one ACTIVE variant per product+color+size
VariantSchema.index({ productId: 1, colorId: 1, sizeKey: 1 },
  { unique: true, partialFilterExpression: { active: true } });
// no duplicate non-empty GTIN among active variants of a product
VariantSchema.index({ productId: 1, gtin: 1 },
  { unique: true, partialFilterExpression: { active: true, gtin: { $type: "string", $gt: "" } } });
VariantSchema.index({ productId: 1, active: 1 });                 // live counts
```

Counts are **derived** (`countDocuments({productId, colorId, active:true})`), never stored or incremented.

#### A4.3 Materials & Composition (Module 2)

```ts
const FiberRow = new Schema({
  fiberCode: { type: String, required: true },          // canonical (elastane == spandex)
  otherName: String,                                    // required if fiberCode === "other"
  percentage: { type: Number, required: true, min: 0.0001, max: 100 },
});
const TrimRow = new Schema({
  componentCode: { type: String, required: true },
  otherName: String,
  materialType: String,
});

const MaterialsSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  mainFabric: {
    fabricType: otherField,
    fibers: [FiberRow],
    compositionTotal: Number,                           // server-computed
    gsm: { type: Number, min: 0.0001 },                 // g/m2
    construction: String,
  },
  trims: [TrimRow],
  ...recordMeta,
}, { timestamps: true });
MaterialsSchema.index({ productId: 1 }, { unique: true });
MaterialsSchema.index({ recordStatus: 1 });
MaterialsSchema.index({ "mainFabric.fibers.fiberCode": 1 });       // "all products containing X" queries
```

Server rule: save requires `abs(sum - 100) <= 0.01`, no duplicate canonical fiber, all `other*` text present.

#### A4.4 Traceability (Module 3)

```ts
// Facility registry: stable entity IDs reused by Traceability AND Certification records
const FacilitySchema = new Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  country: String,
  kind: { type: String, enum: ["garment", "fabric", "yarn", "other"] },
}, { timestamps: true });
FacilitySchema.index({ name: 1, location: 1 }, { unique: true });
FacilitySchema.index({ name: "text", location: "text" });

const FacilityGroup = new Schema({
  facilityId: { type: Schema.Types.ObjectId, ref: "Facility" },
  name: { type: String, required: true },
  location: { type: String, required: true },
  processes: [{ type: String, enum: ["cutting","sewing","garment_finishing","knitting","dyeing","printing","fabric_finishing"] }],
  processStatus: { type: String, enum: ["Assigned", "Unknown", "Not disclosed"], default: "Assigned" },
});

const YarnCard = new Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  country: { type: String, required: true },
  yarnType: String,            // ring_spun, open_end_rotor, compact, air_jet, other, unknown
  yarnCount: String,           // "Ne 30/1"
  composition: String,
  referenceLot: String,
});

const TraceabilitySchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  originDestination: {
    countryOfManufacture: String,
    finalFactory: String,
    finalFactoryLocation: String,
    destinationCountry: String,            // may be "Not specified"
    destinationMarket: String,
    buyerBrand: String,
  },
  tier1: { arrangement: { type: String, enum: ["same", "different", "mixed"] }, facilities: [FacilityGroup] },
  tier2: { arrangement: { type: String, enum: ["same", "different", "mixed"] },
           printingStatus: { type: String, enum: ["Performed", "Not performed", "Unknown"] },
           facilities: [FacilityGroup] },
  tier3: { yarnManufacturers: [YarnCard] },       // min 1 on final save
  ...recordMeta,
}, { timestamps: true });
TraceabilitySchema.index({ productId: 1 }, { unique: true });
TraceabilitySchema.index({ "tier1.facilities.facilityId": 1 });
TraceabilitySchema.index({ "tier2.facilities.facilityId": 1 });
```

Server validation: within a tier, each process assigned **once**; Printing `Not performed` => no printing facility required; `Unknown` => never counts as complete.

#### A4.5 Quality & Lab Testing (Module 4)

```ts
// Master catalogs (edited by admin = standards administrator only)
const TestCatalogSchema = new Schema({
  testId: { type: String, required: true },              // "colour_rubbing"
  name: { type: String, required: true },                // canonical, "Colour Fastness to Perspiration (Sweat)"
  category: { type: String, enum: ["colour", "physical", "mechanical"] },
  methods: [{ methodId: String, label: String, edition: String, editionVerified: { type: Boolean, default: false }, note: String }],   // note = method catalog note from the Addendum
  applicability: [String],                               // product, age group, component, market/buyer profile
  shortSummary: String,                                  // collapsed consumer text
  expandedSummary: String,                               // "Tap for method" text
  resultSchema: [{ key: String, label: String,
                   type: { type: String, enum: ["grade", "number", "text", "enum"] },
                   unit: String, scale: String,          // grey_scale_1_5, blue_wool_1_8, N, %, cycles
                   options: [String], required: Boolean }],
  active: { type: Boolean, default: true },
}, { timestamps: true });
TestCatalogSchema.index({ testId: 1 }, { unique: true });
TestCatalogSchema.index({ name: "text" });

const SubstanceSchema = new Schema({
  key: { type: String, required: true },
  name: String,
  isGroup: Boolean,
  casNumbers: [String],             // never store "Multiple" as a CAS
  components: [String],
  active: { type: Boolean, default: true },
}, { timestamps: true });
SubstanceSchema.index({ key: 1 }, { unique: true });
SubstanceSchema.index({ name: "text", casNumbers: 1 });

const RSLProfileSchema = new Schema({
  key: { type: String, required: true },
  buyerProgram: String,             // buyer / programme
  source: String,                   // buyer RSL / regulation / specification
  version: { type: String, required: true },
  effectiveDate: Date,
  market: String, ageGroup: String, productType: String,
  components: [String],
  criteria: [{
    kind: { type: String, enum: ["test", "substance"] },
    refKey: String,                                      // testId or substance key
    operator: { type: String, enum: ["<=", "<", ">=", ">", "range"] },
    value: Number, valueMax: Number, unit: String, methodId: String,
  }],
  active: { type: Boolean, default: true },
}, { timestamps: true });
RSLProfileSchema.index({ key: 1, version: 1 }, { unique: true });
RSLProfileSchema.index({ market: 1, ageGroup: 1, active: 1 });

// Per product data
const LabReportSchema = new Schema({                      // section 5.1
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  labName: { type: String, required: true },
  reportNumber: { type: String, required: true },         // string, keep punctuation/leading zeros
  overallResult: { type: String, enum: ["Pass","Fail","Conditional Pass","Not Tested"], default: "Not Tested" },
  accreditation: { body: String, certificateRef: String, scopeRef: String, verified: { type: Boolean, default: false } },
  reviewedBy: String, reviewerDesignation: String, signOffDate: Date,
  reportFile: { type: Schema.Types.ObjectId, ref: "Asset" },   // PDF, private
  ...recordMeta,
}, { timestamps: true });
LabReportSchema.index({ productId: 1, labName: 1, reportNumber: 1 }, { unique: true });

const TestResultSchema = new Schema({                     // sections 5.2 + 5.3
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  labReportId: { type: Schema.Types.ObjectId, ref: "LabReport" },
  kind: { type: String, enum: ["physical", "chemical"], required: true },
  testId: String,                                         // physical
  substanceKey: String,                                   // chemical
  methodId: String, methodEdition: String, descriptionId: String,   // approved summary id
  resultState: { type: String, enum: ["Value", "ND", "Not Tested", "Not Applicable", "Unknown"], default: "Value" },
  result: Schema.Types.Mixed,                             // {dry_grade:"4-5", wet_grade:"4-5"} per resultSchema
  reportingLimit: Number,                                 // for ND (<16): kept, never zero
  unit: String, scale: String,
  testDate: Date, sampleLocation: String, component: String,
  rslProfile: { key: String, version: String },
  criterionSnapshot: Schema.Types.Mixed,                  // frozen copy of the rule used
  status: { type: String,
    enum: ["PASS","FAIL","REVIEW REQUIRED","NOT TESTED","NOT APPLICABLE"],
    default: "NOT TESTED" },
  published: { type: Boolean, default: false },
  ...recordMeta,
}, { timestamps: true });
TestResultSchema.index({ productId: 1, kind: 1, testId: 1 });
TestResultSchema.index({ productId: 1, kind: 1, substanceKey: 1 });
TestResultSchema.index({ labReportId: 1 });
TestResultSchema.index({ productId: 1, status: 1 });
```

Evaluator (`lib/services/testEvaluator.ts`): returns PASS or FAIL **only** when a criterion exists and result type, unit, method and profile are compatible; otherwise `REVIEW REQUIRED` ("Result recorded, criterion not configured"). Light fastness uses Blue Wool 1-8, never forced to 1-5.

#### A4.6 Packaging & Disposal, Care & Circularity 6.5 (Module 5)

```ts
const PackagingSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },   // key: care_circularity.packaging_disposal
  packagingType: otherField,
  packagingMaterials: [otherField],                       // multi-select with Other + specify
  recycledContentPercent: { type: Number, min: 0, max: 100, default: null },
  recycledContentStatus: { type: String, enum: ["Provided", "Not Available"], default: "Not Available" },
  recyclability: { type: String, enum: ["Recyclable","Non-recyclable","Conditionally Recyclable","Reusable","Not Available"] },
  disposalReuseInstructions: { type: String },            // line breaks preserved
  ...recordMeta,
}, { timestamps: true });
PackagingSchema.index({ productId: 1 }, { unique: true });
```

`null` percent with status `Not Available` is distinct from `0`.

#### A4.7 Environmental Impact (Module 6)

**Emission factors: no default value is ever seeded.** The 0.50 kg CO2e/kWh grid and 0 solar figures in the guide are illustrative only. The admin must enter each factor with a documented `source` and `yearVersion` (both required by the schema) before any carbon footprint can be calculated. Until an active grid factor and an active solar factor exist, the carbon result is not computed and the form says "Add an emission factor with source and year in Admin > Catalogs to calculate carbon." The value 0.50 appears only inside automated tests as a fixture, against a test database.

```ts
const EmissionFactorSchema = new Schema({                 // edited by admin only
  key: { type: String, required: true },                  // "grid_bd_2024"
  type: { type: String, enum: ["grid", "solar"], required: true },
  kgCo2ePerKwh: { type: Number, required: true, min: 0 },
  source: { type: String, required: true },
  yearVersion: { type: String, required: true },
  methodology: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });
EmissionFactorSchema.index({ key: 1 }, { unique: true });
EmissionFactorSchema.index({ type: 1, active: 1 });

const EnvironmentalSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  inputs: {
    garmentWeightKg:     { type: Number, min: 0.000001 },
    cuttingUtilizationPct: { type: Number, min: 0.0001, max: 100 },
    knittingKwhPerKg: { type: Number, min: 0 },
    dyeingKwhPerKg: { type: Number, min: 0 },
    fabricFinishingKwhPerKg: { type: Number, min: 0 },
    cuttingKwhPerGarment: { type: Number, min: 0 },
    sewingKwhPerGarment: { type: Number, min: 0 },
    garmentFinishingKwhPerGarment: { type: Number, min: 0 },
    gridSharePct: { type: Number, min: 0, max: 100 },
    solarSharePct: { type: Number, min: 0, max: 100 },     // grid + solar must equal 100
  },
  emissionFactors: {                                       // SNAPSHOT at calculation time (traceability)
    gridKey: String, gridValue: Number, solarKey: String, solarValue: Number,
    source: String, yearVersion: String,
  },
  results: {                                               // server-computed, read-only
    fabricRequiredKg: Number,
    kwhPerGarment: { knitting: Number, dyeing: Number, fabricFinishing: Number,
                     cutting: Number, sewing: Number, garmentFinishing: Number },
    totalEnergyKwh: Number, gridEnergyKwh: Number, solarEnergyKwh: Number,
    carbonKgCo2e: Number,
    calculatedAt: Date,
  },
  ...recordMeta,
}, { timestamps: true });
EnvironmentalSchema.index({ productId: 1 }, { unique: true });
```

Calculation (`lib/calc/energy.ts`):

```ts
export function calcEnergy(i: Inputs, ef: { grid: number; solar: number }) {
  if (Math.abs(i.gridSharePct + i.solarSharePct - 100) > 1e-9) throw new Error("Grid + Solar percentage must equal 100%.");
  const fabricKg = i.garmentWeightKg / (i.cuttingUtilizationPct / 100);
  const k = i.knittingKwhPerKg * fabricKg, d = i.dyeingKwhPerKg * fabricKg, f = i.fabricFinishingKwhPerKg * fabricKg;
  const total = k + d + f + i.cuttingKwhPerGarment + i.sewingKwhPerGarment + i.garmentFinishingKwhPerGarment;
  const grid = total * i.gridSharePct / 100, solar = total * i.solarSharePct / 100;
  return { fabricKg, total, grid, solar, carbon: grid * ef.grid + solar * ef.solar };
}
// Unit-test fixture only (test code, never seeded): 0.17 kg, 85% => 0.20 kg; total 1.08 kWh; 65/35 => 0.702 / 0.378; with test factors 0.50 / 0 => 0.351 kg CO2e
```

#### A4.8 Certification & Compliance (Module 7)

```ts
const CertCatalogSchema = new Schema({                    // 16 seeded options, admin extendable
  catalogId: { type: String, required: true },            // "01".."16" or stable keys
  displayName: String, officialName: String,
  defaultRecordType: String, defaultCategory: String,
  description: String, sourceUrl: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });
CertCatalogSchema.index({ catalogId: 1 }, { unique: true });
CertCatalogSchema.index({ displayName: "text" });

const CertRecordSchema = new Schema({
  catalogId: { type: String, required: true },
  recordType: { type: String, required: true,
    enum: ["Certification","Audit/Assessment","Programme","Management System","Legal/Statutory","Product Test/Requirement"] },
  category: String, applicableTo: String, tierStage: String,
  relatedEntityId: { type: Schema.Types.ObjectId, ref: "Facility" },
  productId: { type: Schema.Types.ObjectId, ref: "Product" },
  materialId: Schema.Types.ObjectId, batchId: String,
  scopeText: { type: String, required: true },
  documentNumber: String, issuer: String,
  issueDate: Date, expiryDate: Date, noStatedExpiry: Boolean,
  assessmentDate: Date, reviewDate: Date,
  status: { type: String, default: "Verified",             // admin save = verified; no review workflow, no Expired status
    enum: ["Verified","Not Assessed","Not Applicable","Rejected/Invalid"] },
  notApplicableReason: String, rejectionReason: String,
  complianceOutcome: { type: String,
    enum: ["Not assessed","Compliant","Non-compliant","Not applicable"] },
  requirementName: String,                                // required for Compliant/Non-compliant outcomes
  evidenceType: String,
  evidenceFile: { type: Schema.Types.ObjectId, ref: "Asset" },
  evidenceUrl: String,
  publicEvidenceApproved: { type: Boolean, default: false },
  verificationMethod: String,                              // optional note: how the admin checked it
  remarks: String,
  // Fields that change with recordType (Certification guide section 5); required per type by a Zod discriminated union
  details: {
    audit:       { auditReference: String, auditResult: String /* only if shareable */, findings: String /* private */, remediation: String /* private */, followUpDate: Date },
    programme:   { participationId: String },
    legal:       { authority: String, permitNumber: String, effectiveDate: Date },
    productTest: { testMethod: String, sampleRef: String /* sample / article / batch */, labName: String, resultValue: String, resultUnit: String, reportNumber: String, reportDate: Date },
    requirementLimit: String,                 // exact limit for a named compliance requirement (e.g. wastewater)
  },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  archivedAt: Date,
}, { timestamps: true });

CertRecordSchema.index({ productId: 1, archivedAt: 1 });                          // product page
CertRecordSchema.index({ relatedEntityId: 1, catalogId: 1 });                     // facility certs
CertRecordSchema.index({ status: 1, recordType: 1, archivedAt: 1 });              // dashboard counters
CertRecordSchema.index({ tierStage: 1, status: 1 });                              // filters
CertRecordSchema.index({ catalogId: 1, issuer: 1, documentNumber: 1, relatedEntityId: 1 },
  { partialFilterExpression: { documentNumber: { $type: "string", $gt: "" } } }); // duplicate WARN (non-unique)
CertRecordSchema.index({ scopeText: "text", requirementName: "text", documentNumber: "text" });
```

Status rules in `lib/services/certStatus.ts`:

- No Expired status and no expiry job. `expiryDate` is stored and displayed as a plain date; it never changes the status.
- Single-admin model: saving a record means the admin attests it. Evidence (file or URL) is still recommended and is shown where provided. A Compliant outcome requires `requirementName` and `assessmentDate`.
- `expiryDate >= issueDate`; Not Applicable needs a reason; duplicate certificate ID + issuer + site gives a warning (not hard block).
- Counters use `aggregate([{ $match:{archivedAt:null} }, { $group:{ _id:"$status", n:{$sum:1} } }])` on the status index.
- Conditional fields by record type: Certification needs issuer, certificate ID, scope, issue/expiry, evidence. Audit needs audit date, reference, result if shareable, findings/remediation, follow-up. Programme needs participation/site ID, status, review date. Legal needs authority, permit number, facility, effective/expiry dates. Product test needs method, sample/article/batch, lab, result/unit, report number/date. Irrelevant fields are not required.
- Fairtrade (catalog 07) requires the exact scheme name and scope. Sedex/SMETA: membership (Programme) and audit (Audit/Assessment) are stored as separate records.
- A Compliant record needs the exact named requirement, its limit where one applies, report and assessment date.
- A facility certificate does not certify every garment made there: the public card always shows the record's scope text. Certification logos are not used.
- Counters (live, from active saved records, archived excluded, one record counts once): Certification overview = Total, Verified, Not Assessed, Not Applicable, Rejected/Invalid. Compliance overview = Total, Compliant, Non-compliant, Not Assessed, Not Applicable.

#### A4.9 Assets, audit, published snapshot

```ts
const AssetSchema = new Schema({                          // Cloudinary metadata only
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ["image", "raw", "video"] },
  deliveryType: { type: String, enum: ["upload", "authenticated"], default: "upload" },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  format: String, bytes: Number, width: Number, height: Number,
  secureUrl: String, version: Number,
  purpose: { type: String, enum: ["color_image","lab_report","cert_evidence","audit_report","other"] },
  ownerModel: String, ownerId: Schema.Types.ObjectId,
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
AssetSchema.index({ publicId: 1 }, { unique: true });
AssetSchema.index({ ownerModel: 1, ownerId: 1 });

const AuditLogSchema = new Schema({
  entity: String, entityId: Schema.Types.ObjectId,
  field: String, oldValue: Schema.Types.Mixed, newValue: Schema.Types.Mixed,
  reason: String, changedBy: { type: Schema.Types.ObjectId, ref: "User" }, changedAt: { type: Date, default: Date.now },
});
AuditLogSchema.index({ entity: 1, entityId: 1, changedAt: -1 });
AuditLogSchema.index({ changedBy: 1, changedAt: -1 });

const PublishedDppSchema = new Schema({                   // what the QR page reads
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  shortCode: { type: String, required: true },            // public URL code: /p/<shortCode> (nanoid, non-guessable)
  slug: { type: String },                                  // optional human-readable alias
  version: Number,
  snapshot: Schema.Types.Mixed,                           // ONLY approved public fields
  publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
  publishedAt: Date,
  active: { type: Boolean, default: true },
}, { timestamps: true });
PublishedDppSchema.index({ shortCode: 1 }, { unique: true });
PublishedDppSchema.index({ slug: 1 }, { unique: true, sparse: true });
PublishedDppSchema.index({ productId: 1, version: -1 });
```

#### A4.10 Index summary and rules

| Collection | Key indexes | Purpose |
|---|---|---|
| products | `productId` unique; text; `{status, updatedAt}` | Lookup, search, lists |
| variants | `{productId,colorId,sizeKey}` unique partial; `{productId,gtin}` unique partial | No duplicate pairs/GTINs among active |
| materials / traceability / packaging / environmental | `productId` unique | One record per module per product |
| test_results | `{productId,kind,testId}`, `{labReportId}`, `{productId,status}` | Product test lists, report view |
| lab_reports | `{productId,labName,reportNumber}` unique | No duplicate reports |
| cert_records | `{status,recordType,archivedAt}`, `{expiryDate,status}`, `{productId,archivedAt}`, `{relatedEntityId,catalogId}` | Counters, expiry job, filters |
| dropdown_options | `{list,code}` unique, `{list,active,sortOrder}` | Fast dropdown loading |
| audit_logs | `{entity,entityId,changedAt:-1}` | History view |
| published_dpp | `shortCode` unique | Public QR lookup (hot path) |

Indexing guidance:
- Create indexes via `Model.syncIndexes()` in `scripts/migrate.ts` (not on every cold start in production: set `autoIndex:false`).
- Check slow queries with `.explain("executionStats")` and Atlas Performance Advisor; add indexes only when query patterns are confirmed.
- Partial indexes keep archived/inactive rows from blocking re-use.
- Keep embedded arrays small and bounded (colors <= 20, fibers <= 10, facilities <= 20, yarn cards <= 20) so documents stay far below 16 MB.

---

### A5. Cloudinary Image and File Storage

#### A5.1 What goes where

| Asset | Cloudinary folder | Delivery | Access |
|---|---|---|---|
| Color images | `dpp/{env}/products/{productId}/colors/` | `upload` (public) | Public QR page |
| Lab report PDF | `dpp/{env}/products/{productId}/lab/` | `authenticated` | Signed URL, internal only |
| Certificate / audit evidence | `dpp/{env}/evidence/{recordId}/` | `authenticated` | Signed URL; public only if `publicEvidenceApproved` |

Mongo stores only metadata (`Asset` collection). Never store file bytes in Mongo.

#### A5.2 Signed direct upload flow

1. Client calls `POST /api/cloudinary/sign` with `{ purpose, productId }` (signed-in session and role checked).
2. Server validates allowed type/size per purpose and returns `{ timestamp, signature, folder, apiKey, cloudName, resourceType, type }`.
3. Browser uploads directly to Cloudinary (files never pass through Next.js, avoiding serverless body limits).
4. Client posts the Cloudinary response (`public_id`, `bytes`, `format`, ...) to the module API, which creates an `Asset` and links it.

```ts
// app/api/cloudinary/sign/route.ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET });

const POLICY = {
  color_image: { type: "upload", resource_type: "image", formats: "jpg,jpeg,png,webp", maxBytes: 5_000_000 },
  lab_report:  { type: "authenticated", resource_type: "image", formats: "pdf", maxBytes: 15_000_000 },
  cert_evidence:{ type: "authenticated", resource_type: "image", formats: "pdf,jpg,jpeg,png", maxBytes: 15_000_000 },
} as const;

export async function POST(req: Request) {
  const session = await requireAdmin();                                // lib/auth
  const { purpose, productId } = await req.json();
  const p = POLICY[purpose as keyof typeof POLICY]; if (!p) return Response.json({ error: "bad purpose" }, { status: 400 });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `dpp/${process.env.APP_ENV}/products/${productId}/${purpose}`;
  const params = { timestamp, folder, type: p.type, allowed_formats: p.formats };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
  return Response.json({ ...params, signature, apiKey: process.env.CLOUDINARY_API_KEY,
                        cloudName: process.env.CLOUDINARY_CLOUD_NAME, resourceType: p.resource_type, maxBytes: p.maxBytes });
}
```

Notes:
- Verify the uploaded file server-side: when saving the `Asset`, fetch details with the Admin API (`cloudinary.api.resource`) and confirm folder, type and bytes match the policy.
- Private files: generate time-limited URLs with `cloudinary.url(publicId, { type: "authenticated", sign_url: true, secure: true, expires_at })` in a Route Handler after an admin session check. (This `expires_at` is the signed-URL lifetime, unrelated to certificate expiry.)
- Public images: use `next/image` with a custom Cloudinary loader (`f_auto,q_auto,w_...`) and add `res.cloudinary.com` to `images.remotePatterns`.
- PDFs uploaded as `image` resource type allow page previews; alternatively use `raw` if previews are not needed.
- Replacing/removing: delete the old Cloudinary asset via `cloudinary.uploader.destroy` only after the DB link is updated; keep an `Asset` tombstone if the file was referenced by a verified record (history).

---

### A6. API Design (Route Handlers)

All handlers: `await dbConnect()` > admin session check > Zod parse > service call > audit log > JSON.

| Method + path | Access | Purpose |
|---|---|---|
| `POST/GET /api/products` | admin | Create / list (search, status, pagination) |
| `GET/PATCH/DELETE /api/products/[id]` | admin | Product details, size system, colors; delete product |
| `PUT /api/products/[id]/variants` | admin | Diff-sync selected sizes + GTINs for all colors |
| `GET/PUT /api/products/[id]/materials` | admin | Save (server recomputes total, rejects if not 100%) |
| `GET/PUT /api/products/[id]/traceability` | admin | Save with validation |
| `GET/PUT /api/products/[id]/packaging` | admin | 6.5 form |
| `GET/PUT /api/products/[id]/environmental` | admin | Inputs; returns computed results (422 if no emission factor configured) |
| `POST /api/products/[id]/quality/reports` | admin | Lab report 5.1 |
| `POST/PATCH/DELETE /api/products/[id]/quality/results` | admin | Test / chemical result, auto-evaluate |
| `POST /api/certifications`, `PATCH/DELETE /[id]` | admin | Registry record (DELETE = archive, history kept) |
| `GET /api/certifications/report` | admin | Download Report: approved summary only (see Phase 8.10) |
| `GET/POST/PATCH /api/catalogs/[list]` | admin | Dropdowns, tests, RSL, emission factors, certs |
| `POST /api/cloudinary/sign` | admin | Signed upload |
| `POST /api/publish/[productId]` | admin | Build snapshot, set slug, revalidate; also unpublish |
| `GET /api/public/[code]` | none (rate limited) | Public read-only JSON |

Variant sync algorithm (`PUT .../variants`): load existing variants; for each `(colorId,sizeKey)` in payload set `active=true` (restore `archivedGtin` if present); for each existing active pair absent from payload set `active=false`, move GTIN to `archivedGtin`; report duplicate GTINs before commit; use a Mongo transaction.

---

### A7. Access Model: One Admin, Public Read-Only

Simplified on purpose. The Certification guide allows fewer roles for a small prototype. There is **one signed-in role, `admin`**, plus the public consumer.

| Role | Can do |
|---|---|
| Admin | Add, edit and delete products and every DPP module; upload reports and evidence; maintain all catalogs (methods, RSL limits, substances, emission factors with source and year, dropdowns, size systems); publish and unpublish the public page |
| Consumer (public) | Scan the QR or open the URL and read the published product page. No login, no editing |

Rules:
- **Admin save = verified.** There is no verifier, no Mark verified step and no Draft / Pending / Verified workflow. The admin is the only person who can add or remove DPP data, which is the purpose of the role.
- **No sign-up, no "forgot account" self-service, no public registration route.** The admin account is created by a seed script (`scripts/create-user.ts`); password hashed.
- `middleware.ts` blocks every route except `/login`, `/p/*`, `/api/public/*` and `/api/auth/*` unless a signed-in session exists; every Route Handler also calls `requireAdmin()` (defense in depth).
- Calculated results stay honest: PASS/FAIL appears only when a valid criterion and compatible result exist (otherwise "Result recorded - criterion not configured"), and carbon is computed only when an emission factor with source and year exists.
- Deletes: products may be hard-deleted. Certification records are archived (history kept, per Certification guide section 10). Every create/edit/delete writes an audit entry (who, when, old value).
- "Save Draft" on Variants and Traceability is the guides' own button for saving an incomplete form. It is a form-save, not a verification state.
- Documented limitation for the thesis: in this single-admin prototype the person who enters data also attests it. "Verified" means admin-attested, not independently reviewed.
- Optional hardening: 2FA, login rate limiting and lockout, short session lifetime.

---

### A8. Public Product Page, QR Code and URL (open to anyone)

Every published product gets a **public URL and QR code**. Anyone can open it with no login, account or app.

#### A8.1 URL and QR design

| Item | Design |
|---|---|
| Public URL | `https://<domain>/p/<shortCode>` (example: `https://dpp.example.com/p/k7Xq2mPz9A`) |
| Short code | 10-char random URL-safe code (`nanoid`), unique, **not** the internal `productId` and not guessable or sequential |
| QR code | Encodes the public URL; generated in the admin Review page; downloadable as **SVG** (print) and **PNG** (digital); printable label sheet optional |
| Variant-level QR (optional) | `/p/<shortCode>?v=<variantId>` or GTIN-based link `/p/<shortCode>?gtin=...`, opens the same product page with that color/size highlighted |
| Access | Public, read-only, no authentication; `GET` only |
| Stability | The URL never changes after first publish; republishing creates a new snapshot **version** under the same code |
| Unpublish | `active=false` shows a "This product passport is no longer available" page (HTTP 410); QR keeps working as a stable endpoint |
| Search engines | Configurable: `robots: noindex` by default (QR-only access); admin can allow indexing |
| Language/market | Optional `?lang=` later; not needed for first version |

#### A8.2 Public rendering and caching

- Route: `app/p/[code]/page.tsx` (Server Component) reads `PublishedDpp` by `shortCode` (unique index). No admin controls, no draft data.
- ISR: page cached; `revalidateTag("dpp-" + code)` is called from the publish handler so updates appear immediately.
- Public JSON endpoint (optional, same data): `GET /api/public/[code]`, CORS read-only, rate limited (e.g. 60 req/min/IP), for partners or scanners.
- Not found, unpublished, or invalid code: friendly 404/410 page, no hint whether another product exists.
- Mobile-first layout (consumers scan with phones); fast first paint; images through Cloudinary `f_auto,q_auto`.
- Lightweight analytics: scan count per product (store only `productId`, timestamp, coarse country; no personal data).

#### A8.3 What the public sees (snapshot whitelist)

The snapshot builder (`lib/services/publish.ts`) copies only approved public fields:

- **Product header:** name, style, brand, color/size options.
- **Materials:** fabric type, fiber %, GSM, trims.
- **Traceability:** the saved review summary (process, factory, location per tier; "Not performed" and "Unknown" shown as such).
- **Quality:** published test and chemical records shown as consumer test cards (guide section 8). Lab report line says "Report provided" unless accreditation evidence is entered. PASS/FAIL only when a valid criterion exists.
- **Packaging:** type, materials, recycled content (or "Not available"), recyclability, disposal guidance.
- **Environmental:** total energy, energy mix (grid and solar), carbon footprint, "How was it calculated?" breakdown including the emission factor source and year.
- **Certification:** name, record type, scope summary, linked tier/material/product, status, issue and expiry date as plain dates, approved details link; no private audit findings, personal data or unapproved files (`publicEvidenceApproved` required).
- No demo watermark and no mock data in the database. Enter real data only.

#### A8.4 Publish workflow

1. Admin completes the modules (each module saves only when valid).
2. Admin opens the `Review` page and clicks **Publish**.
3. Server runs publish checks (required modules saved; an emission factor with source and year exists if the Environmental module is shown).
4. Snapshot created (`version + 1`), `shortCode` generated on first publish, cache revalidated.
5. Review page shows the public URL, a **Copy link** button, QR preview, and **Download QR (SVG/PNG)**. Unpublish sets `active=false`.

QR generation (server or client) with the `qrcode` package:

```ts
import QRCode from "qrcode";
const url = `${process.env.NEXT_PUBLIC_SITE_URL}/p/${shortCode}`;
const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
const png = await QRCode.toDataURL(url, { width: 1024, errorCorrectionLevel: "M" });
```

Print rule: minimum QR size about 2 cm x 2 cm on hangtag/label with quiet zone; test scanning before printing.

---

### A8A. Collapsible Sectors and Sub-sectors (Admin and Public UI)

Reason: the DPP holds a lot of data. All **7 sectors** and every **sub-sector** are collapsible so users can hide or show only what they need. This applies to both the admin forms and the public product page.

#### A8A.1 Sector and sub-sector map

| # | Sector (collapsible) | Sub-sectors (each collapsible) |
|---|---|---|
| 1 | Product Variants | 1.1 Size System; 1.2 Colors and Images; 1.3 GTIN Mapping (one collapsible group per color); 1.4 Summary |
| 2 | Materials & Composition | 2.1 Main Fabric Composition; 2.2 Trims & Accessories |
| 3 | Traceability | A. Origin & Destination; B. Tier 1 Garment Manufacturing; C. Tier 2 Fabric Manufacturing; D. Tier 3 Yarn Manufacturing (each yarn card collapsible); E. Manufacturing Summary |
| 4 | Quality & Lab Testing | 5.1 Testing Facility & Certification; 5.2 Chemicals & Restricted Substances; 5.3 Testing (each test card collapsible, "Tap for method" is the innermost collapse) |
| 5 | Care & Circularity | 6.5 Packaging & Disposal (6.1 to 6.4 added when specified) |
| 6 | Environmental Impact | 6.1 Inputs; 6.2 Energy Results; 6.3 Carbon Footprint; 6.4 How was it calculated? |
| 7 | Certification & Compliance | 7.1 Certification Overview; 7.2 Compliance Overview; 7.3 Certification Records; 7.4 Audit / Programme / Compliance Records |

Nesting levels: **Sector > Sub-sector > Item** (item = color card, facility group, yarn card, test card, record row). Three levels maximum to avoid deep nesting.

#### A8A.2 Behavior

| Feature | Behavior |
|---|---|
| Header row | Chevron icon, title, an optional **error dot** when the section has validation errors, and a one-line **summary** shown while collapsed (e.g. "Cotton 95% + Elastane 5% | 180 g/m2", "10 variants", "0.351 kg CO2e") |
| Click target | Whole header is a button; keyboard `Enter`/`Space`; `aria-expanded` and `aria-controls` |
| Default state (admin) | Sector being edited open; others collapsed; sub-sectors with validation errors **auto-expand** |
| Default state (public) | Sector 1 summary open; all others collapsed; test cards collapsed |
| Expand all / Collapse all | Buttons at page top, and per sector for its sub-sectors |
| Remember state | Open/closed state saved per user in `localStorage` (admin) and per session on the public page |
| Deep link | URL hash opens the target, e.g. `#materials-fabric` expands Sector 2 > 2.1 and scrolls to it |
| Errors | If a hidden sub-sector has an error or unsaved changes, header shows a red dot or "Needs attention" and the save/continue action expands it |
| Counts | Header shows how many sub-sections have saved data, such as "3 of 5 sub-sections filled" |
| Lazy render | Collapsed content is not rendered until first open (large lists like GTIN rows, records tables); form state is kept when collapsed so nothing is lost |
| Print / export | Printing or PDF export expands everything |
| Mobile | Single column; sticky mini table of contents or "Jump to sector" dropdown at top; large touch targets (44 px) |
| Animation | Short height transition; disabled for `prefers-reduced-motion` |

#### A8A.3 Reusable component

Use one `Collapsible` component for all three levels (Radix UI `@radix-ui/react-collapsible` / `react-accordion`, or native `<details>` for the public page to work with no JavaScript).

```tsx
// components/ui/CollapsibleSection.tsx
"use client";
import * as C from "@radix-ui/react-collapsible";
import { useState, useEffect } from "react";

type Props = {
  id: string;                       // "materials-fabric" (hash + storage key)
  level: 1 | 2 | 3;                 // sector, sub-sector, item
  title: string;
  summary?: string;                 // shown when collapsed
  status?: "Error";                       // optional; no Draft/Complete/Verified/Pending states
  defaultOpen?: boolean;
  forceOpen?: boolean;              // errors / hash target
  children: React.ReactNode;
};

export function CollapsibleSection({ id, level, title, summary, status, defaultOpen = false, forceOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const saved = localStorage.getItem(`dpp:open:${id}`);
    if (saved !== null) setOpen(saved === "1");
    if (location.hash === `#${id}`) setOpen(true);
  }, [id]);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  const toggle = (v: boolean) => { setOpen(v); localStorage.setItem(`dpp:open:${id}`, v ? "1" : "0"); };

  return (
    <C.Root open={open} onOpenChange={toggle} id={id} className={`sec sec-l${level}`}>
      <C.Trigger className="sec-head" aria-controls={`${id}-body`}>
        <span className="chev" aria-hidden>{open ? "v" : ">"}</span>
        <span className="title">{title}</span>
        {status && <StatusBadge status={status} />}
        {!open && summary && <span className="summary">{summary}</span>}
      </C.Trigger>
      <C.Content id={`${id}-body`} forceMount={undefined}>{children}</C.Content>
    </C.Root>
  );
}
```

Usage (nested):

```tsx
<CollapsibleSection id="materials" level={1} title="2. Materials & Composition" summary="Cotton 95% + Elastane 5%">
  <CollapsibleSection id="materials-fabric" level={2} title="2.1 Main Fabric Composition"> <FabricForm/> </CollapsibleSection>
  <CollapsibleSection id="materials-trims"  level={2} title="2.2 Trims & Accessories">      <TrimsForm/>  </CollapsibleSection>
</CollapsibleSection>
```

Public page (server-rendered, works without JS):

```tsx
<details className="sec sec-l1"><summary>4. Quality & Lab Testing <small>12 tests</small></summary>
  <details className="sec sec-l2"><summary>5.3 Testing</summary>
    <details className="testcard"><summary>Colour Fastness to Rubbing | PASS | 4-5 dry & wet</summary> method text... </details>
  </details>
</details>
```

#### A8A.4 Page-level controls

- **Product page (signed-in):** left sidebar (desktop) or top dropdown (mobile) listing 7 sectors; clicking a sector scrolls and expands it. Buttons: *Expand all*, *Collapse all*, *Show only empty* (filters to sectors with no saved data).
- **Public page:** sticky top bar with product name, QR share button, *Expand all / Collapse all*, and a section jump menu.
- **Search (optional, later):** a filter box that expands matching sub-sectors (e.g. type "GOTS" or "rubbing").

#### A8A.5 Accessibility and testing

- Each header is a real `<button>` (or `<summary>`), visible focus ring, text not relying on color for status.
- Acceptance checks: sector and sub-sector toggle independently; state persists after reload; hash link opens nested target; hidden error expands on save; collapsed forms retain unsaved values; print shows everything; public page toggles work with JavaScript disabled; screen reader announces expanded/collapsed.

---

### A9. Validation and Business Rules Placement

| Rule | Where |
|---|---|
| Composition total = 100 (+/-0.01), range, duplicates, Other text | `validators/materials.ts` + service |
| Grid + solar = 100; ranges; weight > 0 | `validators/environmental.ts` + `calc/energy.ts` |
| Process assigned once per tier; yarn >= 1 | `validators/traceability.ts` |
| GTIN as string, duplicate check, optional length/check digit when GTIN type configured | `services/variants.ts` |
| Test PASS/FAIL only with compatible criterion | `services/testEvaluator.ts` |
| Compliant outcome requires named requirement + assessment date; N/A reason; date order | `services/certStatus.ts` |
| Save enforces full rules (e.g. composition = 100%); no Draft/Complete/Verified state | Zod schemas, same on client and server |
| Unsaved-change warning, retain values on save failure | Client form state (React Hook Form) |

---

## Part II: Phase-by-Phase Build Plan with Test Gates

### Phase-to-reference map

| Phase | Main reference sections in Part I |
|---|---|
| 0 Setup | A1, A2, A3.1, C3, C4 |
| 1 Foundations | A3.2, A4.1, A4.9, A5, A7, A8A |
| 2 Product and Variants | A4.2, A6 (variant sync) |
| 3 Materials | A4.3, A9 |
| 4 Traceability | A4.4, A9 |
| 5 Packaging | A4.6 |
| 6 Environmental | A4.7 |
| 7 Quality & Lab Testing | A4.5 |
| 8 Certification | A4.8 |
| 9 Publish, public URL, QR | A4.9, A8 |
| 10 Hardening | A4.10, C1, C2, C4 |

### How to use this plan

- Work phases in order. Each phase has **sub-phases** (small buildable steps) and a **Test Gate**.
- **A phase is done only when every test in its gate passes.** Do not start the next phase before that.
- Each sub-phase has a checkbox so progress can be tracked.
- Test IDs are `P<phase>-T<number>` so bugs can be traced to a test.
- No mock or demo data is stored in the app database. Example values from the guides (95/5 cotton/elastane, 180 g/m2, 0.50 grid factor, sample certificates) are used only as automated-test fixtures against a test database, never seeded into production.

#### Test types used

| Code | Type | Tool |
|---|---|---|
| U | Unit test (pure logic) | Vitest |
| I | Integration test (API + database) | Vitest + mongodb-memory-server |
| E | End-to-end UI test | Playwright |
| M | Manual check (visual, mobile, accessibility) | Browser + phone |
| S | Security check | Manual + scripts |

#### Definition of Done (every phase)

1. All sub-phase checkboxes ticked.
2. Test Gate: 100% of tests pass; no open critical/major bugs.
3. Works on desktop and a 360 px mobile width.
4. Every new sector and sub-sector is collapsible (see Phase 1.6 component).
5. Code reviewed, merged to main, deployed to staging.
6. Seed/migration scripts updated and re-runnable.

#### Phase overview

| Phase | Name | Estimated time |
|---|---|---|
| 0 | Project setup | 2-3 days |
| 1 | Foundations (auth, catalogs, uploads, collapsible UI) | 1 week |
| 2 | Product and Variants (colors, sizes, GTIN) | 1 week |
| 3 | Materials & Composition | 4-5 days |
| 4 | Traceability | 1 week |
| 5 | Packaging & Disposal (Care & Circularity 6.5) | 2-3 days |
| 6 | Environmental Impact | 4-5 days |
| 7 | Quality & Lab Testing | 1.5 weeks |
| 8 | Certification & Compliance | 1.5 weeks |
| 9 | Review, Publish, Public URL and QR | 1 week |
| 10 | Hardening and Release | 1 week |

---

### PHASE 0: Project Setup

**Goal:** Running skeleton with database, deployment and CI.

#### Sub-phases
- [ ] **0.1 Repository and tooling:** create Next.js (App Router, TypeScript), ESLint, Prettier, Vitest, Playwright, folder structure from the plan.
- [ ] **0.2 Database:** MongoDB Atlas cluster (dev), `lib/db.ts` cached connection, `.env` variables, `autoIndex` setting.
- [ ] **0.3 Cloudinary account:** create cloud, dev folder `dpp/dev`, API keys in env, `lib/cloudinary.ts`.
- [ ] **0.4 CI/CD:** GitHub Actions (lint, type-check, unit tests); deploy preview to Vercel; staging environment variables.
- [ ] **0.5 Health check:** `GET /api/health` returns DB status and app environment.

#### Test Gate: Phase 0

| ID | Type | Test | Expected |
|---|---|---|---|
| P0-T01 | I | Call `/api/health` | 200; `db: "connected"` |
| P0-T02 | I | Call `dbConnect()` 5 times in parallel | One connection reused (no connection leak) |
| P0-T03 | M | Run `npm run build` | Build succeeds, no type errors |
| P0-T04 | M | Push a commit | CI runs lint, type check, tests and passes |
| P0-T05 | M | Open staging URL | Page loads over HTTPS |
| P0-T06 | S | Search repo for secrets | No keys committed; `.env` in `.gitignore` |

---

### PHASE 1: Foundations

**Goal:** Everything shared by all modules: role-based login, configurable dropdowns, file upload, audit log, collapsible UI, status badges.

#### Sub-phases
- [ ] **1.1 Authentication:** Auth.js credentials login, password hashing, session cookie, login page, logout.
- [ ] **1.2 Access:** one role, `admin`, plus the public; no sign-up route; `create-user` seed script creates the admin; `middleware.ts` blocks everything except `/login`, `/p/*`, `/api/public/*`; `requireAdmin()` in every handler; optional 2FA and login rate limit.
- [ ] **1.3 Config catalogs:** `DropdownOption` and `SizeSystem` models and indexes; admin CRUD screen; `GET /api/catalogs/[list]`; seed script for all dropdown lists (fabric, fiber, trims, packaging, yarn type, countries, record types, etc.).
- [ ] **1.4 Cloudinary signed upload:** `/api/cloudinary/sign` with purpose policy (type, size, folder); `Asset` model; upload component with progress and error; private signed-URL helper.
- [ ] **1.5 Audit log:** `AuditLog` model; `writeAudit()` service called on every update to status, results, limits and catalogs.
- [ ] **1.6 Collapsible UI kit:** `CollapsibleSection` (3 levels), expand/collapse all, state in `localStorage`, hash deep link, status badge, summary line, sector sidebar/jump menu, "Needs attention" marker.
- [ ] **1.7 Shared metadata:** `recordMeta` fragment (data source, createdBy, updatedBy); "Other + Specify" field component.

#### Test Gate: Phase 1

| ID | Type | Test | Expected |
|---|---|---|---|
| P1-T01 | I | Login with correct and wrong password | Correct: session created. Wrong: 401, no session |
| P1-T02 | S | Call a protected API without login | 401 |
| P1-T03 | S | No session: open `/products`, `/admin/catalogs`, any `/api/products/*` | Redirect to `/login` (pages) or 401 (API) |
| P1-T04 | S | Look for sign-up / register route or public account creation | None exists (404); only seeded or admin-created users can log in |
| P1-T05 | I | Admin adds a dropdown option; fetch list | New option appears, sorted by `sortOrder` |
| P1-T06 | I | Admin deactivates an option | Hidden from new entries; existing records still display it |
| P1-T07 | I | Insert duplicate `{list, code}` | Rejected by unique index |
| P1-T08 | I | Seed script run twice | No duplicates; same counts both times |
| P1-T09 | I | Request signature for `color_image` with `purpose` unknown | 400 |
| P1-T10 | E | Upload a 1 MB JPG as color image | Upload succeeds; `Asset` created; image previews |
| P1-T11 | E | Upload a `.exe` or 20 MB file | Rejected with clear message |
| P1-T12 | S | Open a private PDF URL without signature | Access denied |
| P1-T13 | I | Update a record status | Audit entry has user, time, old and new value |
| P1-T14 | E | Click sector header | Opens/closes; `aria-expanded` toggles |
| P1-T15 | E | Open sub-sector, reload page | State restored from storage |
| P1-T16 | E | Visit URL with `#materials-fabric` | Parent sector and sub-sector expand and scroll into view |
| P1-T17 | E | Click Expand all, then Collapse all | All three levels open, then all close |
| P1-T18 | E | Field error inside a collapsed sub-sector, press Save | Sub-sector auto-opens and shows error |
| P1-T19 | E | Type in a form, collapse the section, reopen | Typed values still there |
| P1-T20 | M | Keyboard: Tab to header, Enter/Space | Toggles; visible focus ring |
| P1-T21 | E | Select "Other" in a dropdown | Specify text field appears and is required |
| P1-T22 | S | Unauthenticated request to any admin API | 401 |
| P1-T23 | S | Public visitor calls any write endpoint or opens `/admin` | 401 / redirect to login |
| P1-T24 | I | Admin edits a master limit, method or catalog item | Succeeds; audit entry written |
| P1-T25 | I | Admin deletes a product | Removed; audit entry written; public URL returns 410 if it was published |
| P1-T26 | S | Try to register a second account or hit a sign-up route | No such route (404) |

---

### PHASE 2: Product and Variants (Color, Size, GTIN)

**Goal:** Create a product, choose a size system, add colors, select sizes per color, enter GTINs.
**Sector 1** with sub-sectors 1.1 Size System, 1.2 Colors and Images, 1.3 GTIN Mapping, 1.4 Summary.

#### Sub-phases
- [ ] **2.1 Product record:** `Product` model (+ indexes), create/list/search products page, product header with sector navigation.
- [ ] **2.2 Size system:** dropdown (Standard Alpha / European Numeric / Babywear), size options load from `SizeSystem`; change-system confirmation with explicit Reset or Cancel when variants exist; never map M to a numeric size.
- [ ] **2.3 Color cards and count:** start with one color card or an Add Color prompt; stepper (+/-) and quick choices 2, 3, 4, 5 plus Add Color; maximum colors is a setting (default 10), not hard-coded; add/remove/rename colors, stable color IDs, optional color code, duplicate-name warning (repeat only after the user confirms), remove-with-data confirmation that names the colors being removed, soft archive. New colors start with no sizes selected.
- [ ] **2.4 Color images:** Cloudinary upload per color, multiple images, reorder, alt text.
- [ ] **2.5 Per-color sizes:** independent size checkboxes per color; derived counts.
- [ ] **2.6 GTIN fields:** one text input per active color-size pair labelled `Black / M - GTIN`, string storage, trim only, duplicate check, status labels (Draft, GTIN Pending, Valid, Invalid, Archived), archive/restore on deselect; check digit or length only when a GTIN type is configured; no GTIN is ever generated.
- [ ] **2.7 Variant sync API:** `PUT /api/products/[id]/variants` with transaction; partial unique indexes.
- [ ] **2.8 Draft save/reload:** save with blank GTINs; restore all state; reorder colors safely.
- [ ] **2.9 Collapsible layout:** Sector 1 and its 4 sub-sectors; each color card and each color's GTIN group collapsible; summary "3 colors, 10 variants".

#### Test Gate: Phase 2

| ID | Type | Test | Expected |
|---|---|---|---|
| P2-T01 | E | Select Alpha | XS, S, M, L, XL, XXL, 3XL shown |
| P2-T02 | E | Select EU Numeric, then Babywear | Only that system's sizes shown |
| P2-T03 | E | Add colors up to 5 | Five distinct editable cards |
| P2-T04 | E | Rename "Black" to "Jet Black" | GTIN labels and summary show the new name |
| P2-T05 | E | Black: S, M, L, XL | Exactly 4 GTIN inputs under Black |
| P2-T06 | E | White: S, M, L (Black unchanged) | 3 GTIN inputs under White; Black still 4 |
| P2-T07 | E | Navy: M, L, XL | Summary shows **10** total |
| P2-T08 | E | Deselect one empty size | Count 9; row disappears |
| P2-T09 | E | Deselect size with GTIN | Confirmation; GTIN archived; re-select restores it |
| P2-T10 | E | Remove color that has GTINs | Confirmation names the color; other colors unchanged |
| P2-T11 | E | Enter GTIN `0123456789012`, save, reload | Leading zero preserved |
| P2-T12 | I | Two active variants with same GTIN | Rejected by index; UI shows duplicate warning |
| P2-T13 | I | Same color + size twice (active) | Rejected by unique partial index |
| P2-T14 | I | Same color + size, one inactive | Allowed (partial index) |
| P2-T15 | E | Change size system after variants exist | Warning with Reset/Cancel; no silent remap |
| P2-T16 | E | Save draft with blank GTINs, reopen | All colors, sizes, blanks restored |
| P2-T17 | E | Reorder colors | Sizes and GTINs stay with correct color |
| P2-T18 | U | `countActive()` after random toggles | Equals number of checked boxes |
| P2-T19 | E | Color name left blank, final save | Inline error on that color |
| P2-T20 | E | Upload 2 images to a color | Both stored; shown in order; Cloudinary URLs saved |
| P2-T21 | E | Collapse GTIN group, reopen | Values kept; collapsed header shows "4 GTINs" |
| P2-T22 | M | 360 px width | Color cards stack; labels visible |
| P2-T23 | E | Reduce colors from 5 to 3 with the stepper | Confirmation names exactly which colors are removed; others unchanged |
| P2-T24 | E | Final save with zero active colors or zero active variants | Blocked with message |
| P2-T25 | E | Color with no sizes selected | Allowed only as an incomplete draft, clearly marked |
| P2-T26 | E | Rename a color to a name already used | Duplicate warning; allowed only after the user confirms |
| P2-T27 | E | Add a new color | Starts with no sizes selected; no GTIN rows |
| P2-T28 | E | Quick choices 2, 3, 4, 5 | Creates that many color cards; maximum follows the setting (default 10) |
| P2-T29 | E | GTIN row label | Reads `Black / M - GTIN` (color and size in the visible label) |

---

### PHASE 3: Materials & Composition

**Goal:** Main fabric fibers with live total and trims list.
**Sector 2** with sub-sectors 2.1 Main Fabric Composition, 2.2 Trims & Accessories.

#### Sub-phases
- [ ] **3.1 Model and API:** `Materials` model (+ indexes), `GET/PUT /api/products/[id]/materials`, Zod validators (save enforces total = 100%).
- [ ] **3.2 Fabric type:** dropdown with Other + Specify.
- [ ] **3.3 Fiber rows:** repeatable rows, Add Fiber (blank, no auto %), remove row, Other fiber name, canonical map (elastane = spandex).
- [ ] **3.4 Live total:** `calcComposition()` shared by UI and server; tolerance +/-0.01; valid/error state.
- [ ] **3.5 GSM and construction:** optional fields with unit `g/m2`.
- [ ] **3.6 Trims:** Select Component dropdown (with Other), optional Material Type text, Add Component adds the pending entry to the Selected Components list and clears the selector, no identical duplicates (a distinct item is allowed only with separate detail), remove, empty state.
- [ ] **3.7 Metadata:** data source stored; saving requires total = 100% (within 0.01).
- [ ] **3.8 Collapsible layout and summary:** "Cotton 95% + Elastane 5%".

#### Test Gate: Phase 3

| ID | Type | Test | Expected |
|---|---|---|---|
| P3-T01 | U | `calcComposition([95, 5])` | 100, valid |
| P3-T02 | U | `[80, 10]` | 90, invalid (under) |
| P3-T03 | U | `[80, 30]` | 110, invalid (over) |
| P3-T04 | U | `[33.33, 33.33, 33.34]` | 100 within tolerance |
| P3-T05 | E | Cotton 95 + Elastane 5 | Total "100% Valid"; save allowed |
| P3-T06 | E | Cotton 80 + Polyester 10 | "90%"; save blocked; message shows current sum |
| P3-T07 | E | Cotton 80 + Polyester 30 | "110% exceeds 100%"; save blocked |
| P3-T08 | E | Fiber chosen, percentage blank, Save | Inline error on that row |
| P3-T09 | E | Enter -5 or 101 | Rejected |
| P3-T10 | E | Choose Other fiber, no name | Name required error |
| P3-T11 | E | Choose Elastane and Spandex in two rows | Duplicate canonical fiber warning |
| P3-T12 | E | Click Add Fiber | New blank row, focus on selector, no % prefilled |
| P3-T13 | E | Remove one of 3 rows | Only that row removed; total recalculated |
| P3-T14 | E | GSM 0 or negative | Rejected; blank accepted |
| P3-T15 | E | GSM 180, save, reopen, change to 190 | New value survives reload |
| P3-T16 | E | Add Sewing Thread, Main Label, Care Label | All listed and persisted |
| P3-T17 | E | Add Sewing Thread twice | Duplicate prevented |
| P3-T18 | E | Remove Care Label | Only it is removed |
| P3-T19 | E | No trims | Shows "No trims or accessories added yet." |
| P3-T20 | I | Direct API call with total 90 | 422; server enforces rule |
| P3-T21 | S | Save with composition total 90% | 422; not saved |
| P3-T22 | I | Save failure simulation | UI keeps values and shows retry |
| P3-T23 | E | Leave page with unsaved edits | Warning dialog |
| P3-T24 | E | No fiber rows, try to save | Message: "Add at least one fiber to describe the main fabric." |
| P3-T25 | E | Add the same component with a different material detail | Allowed; identical component and detail is blocked |
| P3-T26 | E | Select a trim, enter material, click Add Component | Appears in the list; selector clears for the next entry |
| P3-T27 | E | Save with total under 100 | Message shows the current sum |

---

### PHASE 4: Traceability

**Goal:** Origin and destination, Tier 1, Tier 2, Tier 3 with facility groups.
**Sector 3** with sub-sectors A Origin and Destination, B Tier 1, C Tier 2, D Tier 3, E Summary.

#### Sub-phases
- [ ] **4.1 Models:** `Traceability` and `Facility` models (+ indexes); API; Zod validators (Save Draft allows missing fields; Review & Save enforces required fields and process assignment).
- [ ] **4.2 Origin and destination card:** country dropdowns, final factory, location, destination (or "Not specified"), market, buyer.
- [ ] **4.3 Facility Group component:** name, location, process checkboxes, Add Another Facility, remove with confirmation (reusable for Tier 1 and 2).
- [ ] **4.4 Tier 1:** radio Same / Different / Mixed; fixed processes Cutting, Sewing, Garment Finishing; conditional rendering.
- [ ] **4.5 Tier 2:** same pattern with Knitting, Dyeing, Printing, Fabric Finishing; Printing status dropdown (Performed / Not performed / Unknown).
- [ ] **4.6 Tier 3:** repeatable yarn manufacturer cards; Add Another; Remove with minimum-one rule.
- [ ] **4.7 Process assignment validation:** each process assigned once per tier; warning for unassigned.
- [ ] **4.8 Review summary:** read-only table of process, factory, location.
- [ ] **4.9 Edit arrangement safety:** confirm and preserve data when switching Same/Different/Mixed.
- [ ] **4.10 Collapsible layout:** each tier collapsible; each facility group and yarn card collapsible.

#### Test Gate: Phase 4 (uses TC-01 to TC-10 from the spec)

| ID | Type | Test | Expected |
|---|---|---|---|
| P4-T01 | E | Tier 1 = Same; one factory, tick 3 processes | One entry; 3 processes assigned |
| P4-T02 | E | Tier 1 = Different | Three separate name + location pairs |
| P4-T03 | E | Tier 1 = Mixed: Cutting at A; Sewing + Finishing at B | Two groups; no duplicates |
| P4-T04 | E | Same process ticked in two groups of one tier | Inline error |
| P4-T05 | E | Tier 2 = Same with Printing | One facility; 4 processes |
| P4-T06 | E | Printing status = Not performed | Printing factory not required; summary "Not performed" |
| P4-T07 | E | Printing status = Unknown | Stored as Unknown; not counted as completed |
| P4-T08 | E | Tier 2 Mixed with 3 groups | Each process assigned once; summary correct |
| P4-T09 | E | Add second yarn manufacturer | New blank card; first card data unchanged |
| P4-T10 | E | Remove one of two yarn cards | Confirmation; remaining values preserved |
| P4-T11 | E | Remove the only yarn card | Blocked (min one valid entry) |
| P4-T12 | E | Blank factory name, Review & Save | Error near the field |
| P4-T13 | E | Whitespace-only name | Rejected |
| P4-T14 | E | Change Same to Mixed after data entry | Confirmation; data kept where possible; assignments re-checked |
| P4-T15 | E | Remove facility group | Confirmation; its processes become unassigned |
| P4-T16 | E | Unassigned process at Review & Save | Warning shown |
| P4-T17 | E | Save Draft with missing fields | Saved; missing markers shown |
| P4-T18 | E | Review summary | Every process mapped to factory + location; same factory repeated per row |
| P4-T19 | E | Destination country unknown | "Not specified" accepted; no guessed value |
| P4-T20 | I | Unique index: same facility name + location | Reuses one `Facility` entity |
| P4-T21 | E | Collapse Tier 2, reopen | Data intact; header shows "3 facilities" |
| P4-T22 | M | Mobile layout | Single column; labels above fields; `*` on required |
| P4-T23 | E | Final factory differs from the Tier 1 final finishing site | Warning to match them |
| P4-T24 | E | Open Traceability page | Exact labels from Appendix C (Tier prompts, arrangement options, Add Another Facility, Add Another Yarn Manufacturer, Remove, Review Manufacturing Summary, Save Draft, Review & Save) |
| P4-T25 | E | Unassigned process at Review & Save | Warning; user assigns it or sets Unknown / Not disclosed before final save |
| P4-T26 | E | Tier 3 Country of Origin left blank | Required error |

---

### PHASE 5: Packaging & Disposal (Care & Circularity 6.5)

**Goal:** Compact packaging form shown as sub-sector 6.5 at the end of Care & Circularity.
**Sector 5** with sub-sector 6.5 (6.1 to 6.4 placeholders until specified).

#### Sub-phases
- [ ] **5.1 Model and API:** `Packaging` model (+ unique `productId`), `GET/PUT` handlers, validators.
- [ ] **5.2 Form controls:** Packaging Type dropdown, Packaging Material multi-select with removable chips, Other + Specify.
- [ ] **5.3 Recycled content:** number 0-100 or radio "Not Available" (distinct from 0); not required; no prefilled value; note on the form that the value is an overall declared value.
- [ ] **5.4 Recyclability and instructions:** dropdown; textarea with line breaks preserved.
- [ ] **5.5 Save, edit, reload.**
- [ ] **5.6 Collapsible layout:** Sector 5 > 6.5; placeholders for 6.1 to 6.4 labelled "Not yet specified".

#### Test Gate: Phase 5

| ID | Type | Test | Expected |
|---|---|---|---|
| P5-T01 | E | Select Polybag + Carton, materials LDPE + Corrugated Cardboard | Two chips shown; both saved |
| P5-T02 | E | Remove a material chip | Removed only that value |
| P5-T03 | E | Choose Other for type or material | Specify field appears; required |
| P5-T04 | E | Recycled content 0 | Saved as 0 |
| P5-T05 | E | Choose Not Available | Saved as null + status "Not Available"; distinct from 0 |
| P5-T06 | E | Enter -1 or 101 | Rejected |
| P5-T07 | E | Instructions with 3 lines, save, reload | Line breaks preserved |
| P5-T08 | E | Required field empty (type, material, recyclability, instructions) | Inline errors |
| P5-T09 | E | Select material "Paper" | Recyclability not auto-set |
| P5-T10 | I | Second save for same product | Updates the same document (unique `productId`) |
| P5-T11 | E | Keyboard-only completion | All dropdowns usable |
| P5-T12 | E | Collapse/expand 6.5 | Values kept; header summary shows type and recyclability |
| P5-T13 | E | Open recycled content field | Note says the value is an overall declared value |
| P5-T14 | E | Consumer view with a missing field | Shows "Not available"; no invented value |
| P5-T15 | E | Form buttons | Save Section and Cancel |

---

### PHASE 6: Environmental Impact

**Goal:** Energy inputs, grid/solar mix, admin emission factors, auto-calculated carbon footprint with breakdown.
**Sector 6** with sub-sectors 6.1 Inputs, 6.2 Energy Results, 6.3 Carbon Footprint, 6.4 How was it calculated?

#### Sub-phases
- [ ] **6.1 Emission factor admin:** `EmissionFactor` model; admin screen with required source and year/version; **no values seeded**.
- [ ] **6.2 Model and API:** `Environmental` model (+ unique `productId`); factor snapshot stored per calculation.
- [ ] **6.3 Input form:** garment weight, cutting utilization, six energy inputs (units shown), grid % and solar %.
- [ ] **6.4 Calculation service:** `calcEnergy()` shared server/client; convert kWh/kg to kWh/garment first.
- [ ] **6.5 Validation:** weight > 0; utilization 0-100; energy >= 0; grid + solar = 100.
- [ ] **6.6 Output cards:** total energy, grid energy, solar energy, main carbon card.
- [ ] **6.7 "How was it calculated?"** panel with the 7-step path.
- [ ] **6.8 No-factor guard:** if no active grid or solar factor exists, show "Add an emission factor with source and year in Admin > Catalogs to calculate carbon." and compute no carbon result. The public page shows the factor source and year.

#### Test Gate: Phase 6

| ID | Type | Test | Expected |
|---|---|---|---|
| P6-T01 | U | Weight 0.17, utilization 85 | Fabric required = 0.20 kg |
| P6-T02 | U | Convert Knitting 0.85, Dyeing 1.80, Finishing 0.75 | 0.17, 0.36, 0.15 kWh/garment |
| P6-T03 | U | Add cutting 0.12, sewing 0.18, finishing 0.10 | Total = 1.08 kWh |
| P6-T04 | U | Grid 65 / solar 35 | 0.702 kWh grid; 0.378 kWh solar |
| P6-T05 | U | Test fixture: EF grid 0.50, solar 0 (test code only) | Carbon = **0.351** kg CO2e/garment |
| P6-T06 | U | Grid 60 + solar 30 | Throws "Grid + Solar percentage must equal 100%." |
| P6-T07 | U | Utilization 0, 101, weight 0, negative energy | Each rejected |
| P6-T08 | E | Test DB: create a test factor, enter the guide inputs | Main card shows "0.351 kg CO2e / garment" |
| P6-T09 | E | Change solar to 50 without changing grid | Error shown; no carbon result displayed |
| P6-T10 | E | Open "How was it calculated?" | 7 steps with actual numbers |
| P6-T11 | I | Change emission factor in admin after calculation | Saved record keeps its snapshot; recalculation is explicit |
| P6-T12 | S | Unauthenticated request to edit emission factors | 401 |
| P6-T13 | E | No emission factor configured | No carbon result; guard message shown; public page omits carbon |
| P6-T20 | I | Save emission factor without source or year | 422 |
| P6-T21 | I | Production seed script run | Creates zero EmissionFactor records |
| P6-T14 | I | Direct API with grid + solar != 100 | 422 |
| P6-T15 | E | Collapse Inputs, edit nothing, reopen | Results unchanged; header summary shows carbon value |
| P6-T16 | M | Mobile | Cards readable; units visible |
| P6-T17 | E | Leave any required input blank, calculate | Required error on that field; no result shown |
| P6-T18 | E | Dashboard | Shows total energy, grid energy, solar energy and carbon, all with units |
| P6-T19 | E | Public page | Shows total energy, energy mix (grid/solar), carbon footprint and the calculation breakdown |

---

### PHASE 7: Quality & Lab Testing

**Goal:** Lab report details, chemical/RSL results, 12 physical/colour tests with controlled PASS logic and consumer test cards.
**Sector 4** with sub-sectors 5.1 Testing Facility, 5.2 Chemicals, 5.3 Testing (each test card collapsible).

#### Sub-phases
- [ ] **7.1 Catalogs:** `TestCatalog` (12 tests, methods, short/expanded summaries, result schema), `Substance` (11 starter), `RSLProfile`; admin screens; seed.
- [ ] **7.2 Lab report (5.1):** `LabReport` model; fields; PDF upload (private); overall result; reviewer sign-off; accreditation evidence rule.
- [ ] **7.3 Test selection and result entry (5.3):** searchable "Select Test"; form generated from `resultSchema` (dry/wet, acidic/alkaline, length/width, force N, cycles).
- [ ] **7.4 Scales and units:** grey-scale 1-5 with half grades; Blue Wool 1-8 for light fastness.
- [ ] **7.5 Chemical entry (5.2):** substance search, CAS autofill, group handling ("Multiple - see substance list"), ND with reporting limit, Not Tested / Not Applicable / Unknown.
- [ ] **7.6 RSL profile selector:** buyer, market, age group, component, source/version/effective date; limits loaded from profile only.
- [ ] **7.7 Evaluator:** `testEvaluator()` returns PASS/FAIL only with compatible criterion, else REVIEW REQUIRED.
- [ ] **7.8 Sign-off fields:** reviewer name, designation and sign-off date are plain fields the admin fills (Quality guide 5.1); PASS/FAIL only from valid criteria.
- [ ] **7.9 Consumer test card:** compact card, "Tap for method" expands method text, result breakdown, criterion, date, report reference.
- [ ] **7.10 Collapsible layout:** each test card and chemical row collapsible; header shows test name + status pill.

#### Test Gate: Phase 7

| ID | Type | Test | Expected |
|---|---|---|---|
| P7-T01 | I | Seed catalogs | 12 unique tests; perspiration/sweat appears **once** |
| P7-T02 | E | Select "Colour Fastness to Rubbing" | Form shows Dry and Wet grade; method and summary autofilled |
| P7-T03 | E | Select Light Fastness | Scale is Blue Wool 1-8, not 1-5 |
| P7-T04 | E | Select Dimensional Stability | Length % and width % (signed); wash procedure field |
| P7-T05 | E | Select Perspiration | Acidic and alkaline entered separately |
| P7-T06 | E | Enter grade 4-5 (half grade) | Accepted; grade 6 rejected |
| P7-T07 | E | Upload report PDF, add report number `00123-A` | Number preserved exactly; file private |
| P7-T08 | E | Lab name entered, no accreditation evidence | Shows "Report provided", not "Accredited" |
| P7-T09 | U | Rubbing 4-5/4-5 vs criterion "min 4", compatible method | PASS |
| P7-T10 | U | Rubbing 3 vs criterion "min 4" | FAIL |
| P7-T11 | U | No criterion configured | REVIEW REQUIRED, "criterion not configured" |
| P7-T12 | U | Unit mismatch (% vs N) | REVIEW REQUIRED |
| P7-T13 | U | Formaldehyde 16 mg/kg, profile limit <=75 | PASS (illustration profile) |
| P7-T14 | U | Result "ND (<16)" | Stored as ND with reporting limit 16; **not** zero |
| P7-T15 | E | Choose PFAS (group) | Shows "Multiple - see substance list"; no fake CAS |
| P7-T16 | E | Set Not Tested, Not Applicable, Unknown, ND | Four distinct states and badges |
| P7-T17 | S | Result-entry form tries to change an RSL limit or method | Not editable there; limits change only on the admin catalog screen, with audit entry |
| P7-T18 | I | Change RSL profile version later | Old result keeps `criterionSnapshot` of the old version |
| P7-T19 | E | Admin fills reviewer name, designation, sign-off date | Saved and shown on the lab report card; audit entry |
| P7-T20 | E | Result with no configured criterion | "Result recorded - criterion not configured"; REVIEW REQUIRED; never PASS |
| P7-T21 | E | Test card default | Description hidden; "Tap for method" visible |
| P7-T22 | E | Tap, then tap again | Expands (method, breakdown, criterion, date, report ref), then collapses; keyboard works |
| P7-T23 | I | Duplicate report (same product, lab, number) | Rejected by unique index |
| P7-T24 | E | Overall result "Pass" with one test FAIL | Both shown; summary does not hide the failed test |
| P7-T25 | M | Mobile test card layout | Method top-left, status pill top-right, large result |
| P7-T26 | E | Consumer test card | Order: method top-left, status pill top-right, test name, large result with qualifier or requirement, divider, short result summary, muted "Tap for method" |
| P7-T27 | E | Expand the card | Method description, result breakdown, test condition, criterion/source/version, test date, approved report reference; control reads "Hide method" |
| P7-T28 | E | Grey-scale test result | Grade interpretation aid (5 Excellent ... 1 Very poor) shown; not shown for Blue Wool |
| P7-T29 | E | Select a substance | Populates canonical name, CAS, component/application, approved method, limit, unit, RSL source/version; user enters result and report metadata |
| P7-T30 | E | Missing criterion | Shows "Result recorded - criterion not configured" and REVIEW REQUIRED |
| P7-T31 | E | RSL profile selector | Captures buyer/programme, destination market, product type, age group, component scope, source/version, effective date |

---

### PHASE 8: Certification & Compliance

**Goal:** Evidence registry for 16 catalog options with simple statuses, history and dashboard counters (no expiry job, no review workflow).
**Sector 7** with sub-sectors 7.1 Certification Overview, 7.2 Compliance Overview, 7.3 Certification Records, 7.4 Audit/Programme/Compliance Records.

#### Sub-phases
- [ ] **8.1 Catalog and model:** `CertCatalog` (16 seeded, admin extendable), `CertRecord` (+ all indexes), history via `AuditLog`.
- [ ] **8.2 Record form:** certification/standard form (left) and compliance form (middle) with the records list and Add New (right); record type drives conditional fields; searchable standard dropdown; Applicable To; tier/stage; related facility/supplier (stable entity ID); product/material/batch; scope; dates; evidence type plus upload/link; optional verification note; remarks. After save: confirmation, refreshed list and counters.
- [ ] **8.3 Status rules:** `certStatus()` validates date order, N/A reason and Compliant requirements; no Expired override.
- [ ] **8.4 Archive endpoint:** admin archives a record; history kept.
- [ ] **8.5 Records table:** columns name/type, applicable entity, tier/facility, status, validity or assessment date, View Details; search and filter by tier, standard, status, facility; edit/archive.
- [ ] **8.6 Dashboard counters:** Certification overview (Total, Verified, Not Assessed, Not Applicable, Rejected/Invalid) and Compliance overview (Total, Compliant, Non-compliant, Not Assessed, Not Applicable) from live data; one record counts once; archived excluded.
- [ ] **8.7 Expiry dates:** `expiryDate` is stored and shown as a plain date; no status change, no cron.
- [ ] **8.8 Privacy:** `publicEvidenceApproved` flag; hide private files/findings in public view.
- [ ] **8.9 Collapsible layout:** four sub-sectors; each record row expands to details.
- [ ] **8.10 Download Report:** exports an approved-fields summary; omits private evidence unless allowed.

#### Test Gate: Phase 8

| ID | Type | Test | Expected |
|---|---|---|---|
| P8-T01 | I | Seed catalog | 16 options with stable IDs |
| P8-T02 | E | Search "GOTS" in dropdown | Found; selecting it does **not** set any status |
| P8-T03 | E | Admin adds and deactivates a catalog item | Old records still show the deactivated name |
| P8-T04 | E | Record Type = Product Test | Test method, lab, result, report number fields appear |
| P8-T05 | E | Record Type = Certification | Issuer, certificate ID, scope, dates, evidence required |
| P8-T06 | E | Expiry before issue date | Save blocked; date-order message |
| P8-T07 | E | Record with a past expiry date | Date is shown; status unchanged; no Expired badge |
| P8-T08 | E | Save a record as admin | Status Verified (admin-attested); audit entry written |
| P8-T09 | S | Create/edit/archive a record without a session | 401 |
| P8-T10 | I | Mark Compliant without requirement name/assessment date/evidence | 422 |
| P8-T11 | E | Not Applicable without reason | Required reason error |
| P8-T12 | E | Same certificate ID + issuer + site twice | Warning; allowed only after confirming distinct scope |
| P8-T13 | E | Facility certificate selected, product linked | Warns if scope text does not cover product; no auto-certify |
| P8-T14 | E | Tier/entity mismatch | Warning and correction/reason required |
| P8-T15 | I | Counters after create, edit, archive | Certification: Total, Verified, Not Assessed, Not Applicable, Rejected/Invalid. Compliance: Total, Compliant, Non-compliant, Not Assessed, Not Applicable. One record counted once; archived excluded |
| P8-T16 | I | Delete a record from the UI | Archived, not erased; history viewable |
| P8-T17 | E | Filter by tier and status | Table shows matching rows only |
| P8-T18 | E | Edit a saved record | Stays valid; audit shows old/new |
| P8-T19 | S | Private evidence in public view | Hidden unless `publicEvidenceApproved` |
| P8-T20 | E | Production database after seeding | Contains the 16 catalog options and no certification records |
| P8-T21 | E | Open record row | Expands details, evidence link, status history |
| P8-T22 | M | Mobile list and form | Usable; upload feedback visible |
| P8-T23 | E | Record type Audit, Programme, Legal | Each shows only its own conditional fields (Certification guide section 5) |
| P8-T24 | E | Fairtrade selected without scheme name and scope | Blocked |
| P8-T25 | E | Sedex membership and SMETA audit | Saved as two separate records |
| P8-T26 | E | Download Report | Only approved fields; private evidence omitted unless allowed |
| P8-T27 | E | Consumer view of a record | Shows name, record type, scope summary, linked tier/material/product, status, dates, approved details link |
| P8-T28 | E | Consumer view of a facility certificate | Scope text always shown; no logo; not presented as certifying every garment |
| P8-T29 | E | Compliant outcome without exact requirement, limit, report or assessment date | Blocked; missing items listed |
| P8-T30 | E | Same product with several records on different tiers/entities | All listed; each linked correctly |

---

### PHASE 9: Review, Publish, Public URL and QR

**Goal:** Admin reviews all sectors, publishes, and anyone can open the product by URL/QR with no login.

#### Sub-phases
- [ ] **9.1 Review page:** all 7 sectors with status, missing items, "Needs attention"; Expand/Collapse all.
- [ ] **9.2 Publish checks:** required modules saved; emission factor with source and year exists if Environmental is shown.
- [ ] **9.3 Snapshot builder:** `PublishedDpp` with `shortCode` (nanoid), version; whitelist of public fields only.
- [ ] **9.4 Public page `/p/[code]`:** server-rendered, mobile-first, no login, collapsible sectors and sub-sectors (default: summary open, rest closed), test cards collapsed.
- [ ] **9.5 Cache and revalidation:** ISR with `revalidateTag`; republish updates the same URL with new version.
- [ ] **9.6 QR generation:** SVG and PNG download, copy link button; optional variant link `?v=`.
- [ ] **9.7 Public JSON API:** `GET /api/public/[code]` with rate limit.
- [ ] **9.8 Unpublish and errors:** 404 invalid code; 410 unpublished page.
- [ ] **9.9 Scan counter:** anonymous count per product.
- [ ] **9.10 Public page collapsible polish:** sticky top bar, jump menu, works without JavaScript (`<details>`).

#### Test Gate: Phase 9

| ID | Type | Test | Expected |
|---|---|---|---|
| P9-T01 | E | Publish a complete product | `shortCode` created; URL and QR shown |
| P9-T02 | E | Open URL in a private window (not logged in) | Page loads; no login prompt |
| P9-T03 | M | Scan QR with a phone camera | Opens the same public page |
| P9-T04 | E | Inspect public page data | Only whitelisted fields; no drafts, internal notes, user emails, private files |
| P9-T05 | I | `GET /api/public/[code]` | Same data as page; no internal `_id` of users or admin fields |
| P9-T06 | I | Public `POST/PUT/DELETE` to any public route | 405 |
| P9-T07 | E | Test result with no criterion | Shown as "Result recorded - criterion not configured"; not PASS |
| P9-T08 | E | Certificate with private evidence | Name/status/dates shown; file hidden |
| P9-T09 | E | Unpublish a product | Public URL returns 410; QR keeps resolving to that page |
| P9-T10 | E | Edit, republish | Same URL; new content after revalidation; version +1 |
| P9-T11 | E | Unpublish | URL returns 410 page with friendly message |
| P9-T12 | E | Visit `/p/invalidcode` | 404; no hint about other products |
| P9-T13 | S | Try guessing codes (sequential/productId) | Not found; codes are random |
| P9-T14 | S | 100 rapid requests from one IP | Rate limit returns 429 |
| P9-T15 | E | Public page defaults | Sectors collapsed except summary; test cards collapsed |
| P9-T16 | E | Expand all / collapse all, jump menu | Works on every sector and sub-sector |
| P9-T17 | M | Disable JavaScript | `<details>` still toggles; content readable |
| P9-T18 | E | Print / Save PDF | Everything expanded |
| P9-T19 | M | QR download SVG/PNG, print at 2 x 2 cm | Scans reliably |
| P9-T20 | M | Lighthouse mobile | Performance and Accessibility >= 90 |
| P9-T21 | E | Variant link `?v=` | Highlights that color/size |
| P9-T22 | I | Scan counter | Increments; stores no personal data |

---

### PHASE 10: Hardening and Release

**Goal:** Full regression, security, performance, accessibility, production deployment.

#### Sub-phases
- [ ] **10.1 Full regression:** run all phase gates again on staging.
- [ ] **10.2 Index review:** `explain("executionStats")` on slow queries; confirm indexes used; `syncIndexes` in migration.
- [ ] **10.3 Security review:** role check on every non-public route, rate limits, input sanitization, secrets, private file access.
- [ ] **10.4 Performance:** pagination on lists; lazy render in collapsed sections; image optimization.
- [ ] **10.5 Accessibility and responsive pass:** keyboard, screen reader, contrast, 360 px to desktop.
- [ ] **10.6 Data and backup:** Atlas backups; seed production catalogs only (no demo data, no emission factors).
- [ ] **10.7 Documentation:** admin guide (entry, publish), README, env variable list.
- [ ] **10.8 Production deploy and smoke test.**
- [ ] **10.9 Pilot with real product:** enter one real product from factory BOM/lab report; record data source; enter a documented emission factor with source and year before publishing.

#### Test Gate: Phase 10

| ID | Type | Test | Expected |
|---|---|---|---|
| P10-T01 | E | Run entire Playwright suite on staging | 100% pass |
| P10-T02 | I | Full flow: create product > all 7 sectors > publish | Public page matches saved data |
| P10-T03 | S | Call every write route with no session, with the wrong role, then with the right role | No session: 401/redirect. Wrong role: 403. Right role: succeeds. Public routes are GET-only |
| P10-T04 | S | Injection strings (`$ne`, `<script>`) in text fields | Rejected or escaped; no Mongo operator injection |
| P10-T05 | S | Private Cloudinary URL after expiry | Access denied |
| P10-T06 | I | Query plans for product list, cert counters, public lookup | Use indexes (IXSCAN), no COLLSCAN |
| P10-T07 | I | 1,000 products, 20 cert records each | Lists paginate; public page under 1 s server time |
| P10-T08 | M | Screen reader on one sector | Headers announce expanded/collapsed |
| P10-T09 | M | Test on Android + iPhone, small and large screens | Layout and QR scan work |
| P10-T10 | M | Restore from backup (staging) | Data recovered |
| P10-T11 | M | Production smoke test | Login, create, publish, scan QR all work |
| P10-T12 | M | Pilot product review | No example values; every value has a data source; emission factor has source and year |
| P10-T13 | M | Documentation walkthrough | A new user completes one product using only the guide |

---

### Cross-Phase Regression Checklist (run at the end of every phase)

| Check | Pass condition |
|---|---|
| Earlier phase gates | All still pass |
| Collapsible behavior | New sectors toggle, remember state, auto-open on errors |
| Invalid vs valid save | Invalid records cannot be saved (composition, dates, required fields) |
| Example data | Used only as test fixtures; never seeded into production |
| Audit log | Status and result changes recorded |
| Mobile | Usable at 360 px |
| Build and lint | Clean |

### Bug Handling

| Severity | Definition | Rule |
|---|---|---|
| Critical | Data loss, security hole, wrong PASS/Verified shown | Fix before gate sign-off |
| Major | Feature broken or wrong calculation | Fix before gate sign-off |
| Minor | Visual or wording issue | Log; fix in Phase 10 at the latest |

### Milestone Summary

| Milestone | After phase | What can be demonstrated |
|---|---|---|
| M1: Role-based shell | 1 | Role-based login, dropdown admin, uploads, collapsible layout |
| M2: Core data entry | 5 | Variants, materials, traceability, packaging forms |
| M3: Calculations and quality | 7 | Carbon footprint, lab tests with controlled PASS logic |
| M4: Registry complete | 8 | Certification and compliance with counters |
| M5: Public launch | 9 | Public URL + QR for anyone |
| M6: Release | 10 | Production, pilot product, documentation |

---

## Part III: Testing, Security, Deployment and Open Questions

### C1. Testing Plan

- **Unit (Vitest):** `calcEnergy` (test fixture 0.351), composition total, tolerance, variant sync, testEvaluator (ND keeps reporting limit, missing criterion -> REVIEW REQUIRED), certStatus (date order, N/A reason, Compliant requirements).
- **Integration:** Route Handlers against `mongodb-memory-server`; verify unique/partial indexes reject duplicates (GTIN, color+size, report number).
- **E2E (Playwright):** the acceptance tests from the spec: add/remove fibers, 95/5 valid, 80/10 blocked; Black 4 + White 3 + Navy 3 = 10 variants; GTIN leading zero survives reload; mixed-mode traceability; Printing not performed; cert Verified blocked without evidence; public page hides pending data.
- **Security:** unauthenticated access attempts on every non-public route; Cloudinary private URL not reachable without signature; upload type/size rejection.
- **Accessibility/responsive:** keyboard navigation, labels on every checkbox/GTIN input, 360px mobile layout.

---

### C2. Security and Compliance

- Passwords hashed (bcrypt/argon2); sessions as httpOnly cookies; CSRF-safe via same-site cookies.
- Rate limit auth and signing endpoints; sanitize text fields (Zod `trim`, max lengths).
- Secrets only in server env vars (`CLOUDINARY_API_SECRET`, `MONGODB_URI`, `NEXTAUTH_SECRET`).
- Private evidence only through short-lived signed URLs after the role check.
- Public API surface limited to `PublishedDpp` snapshot reads; non-guessable `shortCode`, rate limiting, read-only `GET`, no internal IDs exposed.
- Audit trail for status changes, result edits, catalog/limit edits.
- Research integrity: no demo data in production; data source stored per record; PASS/FAIL only from valid criteria; no carbon figure without a documented emission factor.

---

### C3. Environment Variables

```
MONGODB_URI=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
APP_ENV=dev|staging|prod
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_SITE_URL=
```

---

### C4. Deployment

- Host on Vercel (or any Node host); MongoDB Atlas (M0/M10 start), IP allow-list or private networking.
- Separate Atlas databases and Cloudinary folders per `APP_ENV` (dev / staging / prod).
- No cron jobs.
- Run `scripts/migrate.ts` (syncIndexes) and `scripts/seed.ts` (catalogs: dropdown lists, size systems, 12 tests with summaries, 11 starter substances, 16 certification options) on each environment.
- Atlas backups enabled; monitor with Atlas alerts and Vercel logs.

---

### C5. Seed Data Checklist

- [ ] DropdownOption lists: fabric types (11), fibers (16, with elastane/spandex alias), trims (17), packaging types (6), packaging materials (7), recyclability (5), yarn types, record types, categories, applicable-to, tier/stage, evidence types, verification methods, countries.
- [ ] SizeSystem (exact options from the Variants guide): `alpha` XS, S, M, L, XL, XXL, 3XL; `eu_numeric` 36/38, 40/42, 44/46, 48/50, 52/54; `babywear` 0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M.
- [ ] TestCatalog: 12 tests with method label, edition (marked unverified), short and expanded summaries, result schema and scale.
- [ ] Substance: 11 starter substances with the CAS handling in Appendix C (Formaldehyde 50-00-0, PCP 87-86-5, DMF 68-12-2; groups show "Multiple - see substance list", never a fake CAS).
- [ ] CertCatalog: the 16 options.
- [ ] EmissionFactor: **seed nothing.** The admin enters the grid and solar factors with source and year after deployment.
- [ ] No demo product. Use TSH-001 (95% cotton / 5% elastane, 180 g/m2, 0.17 kg) only inside automated tests.
- [ ] No demo certification records (Appendix C.6 removed).
- [ ] Test catalog seed text: use the Addendum summaries (collapsed and expanded) verbatim; result fields per Appendix B.

---

### C6. Open Questions to Confirm Before Build

1. Multi-tenant (several factories/brands) or single organization? (adds `orgId` to every collection and index)
2. Is GTIN uniqueness needed across all products, or only within one product? (spec says within product; global is a simple index change)
3. Which RSL/buyer profiles and which test method editions will be loaded first?
4. Is Care & Circularity 6.1 to 6.4 (care, stain, repair, upcycling) in scope? No spec was provided.
5. Which documented emission-factor source and year will you enter for grid and solar? (Required before any carbon figure can be shown.)
6. Should the public page show GTINs and facility names, or keep them internal?
7. Roles: single `admin` account. Who holds the login?
8. Should public pages be indexed by search engines (default: no, QR-only)?
9. Is one QR per product enough, or one per color/size variant (or per GTIN)?


---

## Appendix A: Coverage matrix (8 guides to plan and tests)

Guides: **MAT** Materials, **TRC** Traceability, **CRT** Certification & Compliance, **ENV** Environmental, **QLT** Quality & Lab Testing, **VAR** Color-Size-GTIN, **PKG** Packaging, **ADD** Test Methods Addendum.
"Covered in" points to the plan section, sub-phase or test that implements the requirement. Any row without a test ID would be a gap.

### MAT: Materials & Composition

| Requirement | Covered in |
|---|---|
| Fabric type dropdown (11 options incl. Other + Specify) | A4.3, Phase 3.2, C5, Appendix C; P3-T10 |
| Fiber rows: dropdown, 0-100 %, decimals, Add Fiber appends blank row, no auto % | Phase 3.3; P3-T08, T09, T12 |
| Remove row; total read-only, live, valid/error | Phase 3.3, 3.4; P3-T13, T05 to T07 |
| Elastane = Spandex canonical; duplicate fiber warning | A4.3, 3.3; P3-T11 |
| 16 fiber options, 17 trim options | C5, Appendix C |
| GSM optional positive (g/m2); construction optional | Phase 3.5; P3-T14, T15 |
| Trims: select, optional material, Add Component, list, remove, no identical duplicate | Phase 3.6; P3-T16 to T19, T25, T26 |
| Total = 100 with documented tolerance +/-0.01 before save | A4.3, 3.4; P3-T01 to T07, T20 |
| Error and empty messages (no fiber, under/over, blank %, no trims, save failure) | P3-T24, T27, T06, T07, T08, T19, T22 |
| Composition must total 100% to save (Draft/Complete/Verified dropped by decision) | A3.2, 3.7; P3-T21 |
| Unsaved-edit warning; values kept after save failure | P3-T22, T23 |
| Data source stored per record; no example data in production | A3.2 `recordMeta`; Phase 10.9 |
| Save, edit, reload; read-only DPP view | P3-T15; Phase 9 |

### TRC: Traceability

| Requirement | Covered in |
|---|---|
| Section A fields (country, final factory, location, destination or Not specified, market, buyer) | A4.4, Phase 4.2; P4-T19 |
| Final factory matches Tier 1 final site | P4-T23 |
| Tier 1 and Tier 2 arrangement: Same / Different / Mixed with fixed process lists | Phase 4.3 to 4.5; TC-01 to TC-06 = P4-T01 to T08 |
| Printing status Performed / Not performed / Unknown | Phase 4.5; P4-T06, T07 |
| Facility group card, Add Another Facility, remove with confirmation | Phase 4.3; P4-T15 |
| Process assigned once per tier; unassigned warning; Unknown / Not disclosed | Phase 4.7; P4-T04, T16, T25 |
| Tier 3 yarn cards with all fields; Add Another; Remove with minimum one | Phase 4.6; P4-T09 to T11, T26 |
| Review summary (process, factory, location; Not performed / Unknown shown) | Phase 4.8; P4-T18 |
| Save Draft vs Review & Save; edit arrangement confirmation | Phase 4.9; P4-T14, T17 |
| Whitespace rejected; no guessed values | P4-T13, T19 |
| Exact UI text and buttons | Appendix C; P4-T24 |
| Desktop vertical stack, mobile single column, labels above, `*` required | Design 8.8; P4-T22 |

### CRT: Certification & Compliance

| Requirement | Covered in |
|---|---|
| 16 options with stable IDs; admin add/deactivate | A4.8, Phase 8.1; P8-T01 to T03 |
| Selection never sets a status | P8-T02 |
| Roles: single Admin + Consumer (guide allows fewer roles for a prototype) | A7; P1-T22 to T26 |
| Form fields (record type, category, name, applicable to, tier/stage, entity, product/material/batch, ID, issuer, scope, dates, status, outcome, evidence, optional verification note, remarks) | A4.8, Phase 8.2 |
| Conditional fields by record type | A4.8 `details`; P8-T04, T05, T23 |
| Status logic (10 statuses incl. Compliant / Non-compliant) | A4.8, Phase 8.3; P8-T07, T08, T10 |
| Expiry date stored and shown as a plain date; no Expired status (decision) | P8-T07 |
| Fairtrade scheme and scope; Sedex membership and audit separate | P8-T24, T25 |
| Multiple records per product; duplicate warning | P8-T12, T30 |
| Counters (both overviews), live, archived excluded | Phase 8.6; P8-T15 |
| Records table, search/filter by tier, standard, status, facility, View Details | Phase 8.5; P8-T17, T21 |
| Consumer view fields; hide private files and findings; no logos | A8.3; P8-T19, T27, T28 |
| Internal view: all fields, evidence, reviewer, history, edit/archive | Phase 8.9; P8-T21 |
| Validation (date order, compliant without requirement, tier mismatch, N/A reason) | P8-T06, T10, T11, T14, T29 |
| Download Report (approved fields) | Phase 8.10; P8-T26 |
| Demo seed records (six): dropped by decision; no demo data | P8-T20 |
| Mobile form and upload feedback | P8-T22 |

### ENV: Environmental Impact

| Requirement | Covered in |
|---|---|
| Inputs (weight, utilization, six energy values, grid/solar %) | A4.7, Phase 6.3 |
| Fabric required = weight / utilization; convert kWh/kg first | Phase 6.4; P6-T01, T02 |
| Total, grid and solar energy; carbon formula; 0.351 test fixture only; no default factor | P6-T03 to T05, T08, T13 |
| Emission factors in admin settings with source and year | Phase 6.1; P6-T11, T12 |
| Validation rules and required fields | Phase 6.5; P6-T06, T07, T14, T17 |
| Dashboard outputs and main card | Phase 6.6; P6-T08, T18 |
| "How was it calculated?" 7 steps | Phase 6.7; P6-T10 |
| Public display (total, energy mix, carbon, breakdown) | A8.3; P6-T19 |

### QLT and ADD: Quality & Lab Testing, Test Method Addendum

| Requirement | Covered in |
|---|---|
| Roles: single Admin + Consumer; reviewer name/designation/date kept as plain fields | A7; P1-T22 to T26, P7-T19 |
| 5.1 fields, PDF upload, accreditation wording | A4.5 `LabReport`, Phase 7.2; P7-T07, T08, T24 |
| 5.2 substance catalog, CAS and groups, auto-populate on select | Phase 7.5; P7-T15, T29 |
| ND with reporting limit; Not Tested / N/A / Unknown distinct | P7-T14, T16 |
| RSL profile fields, versioning, limits from profile only | A4.5 `RSLProfile`, Phase 7.6; P7-T13, T17, T18, T31 |
| Evaluator PASS/FAIL only with compatible criterion; else REVIEW REQUIRED | Phase 7.7; P7-T09 to T12, T30 |
| 12 unique tests; sweat once; method notes; result fields; scales | Appendix B; P7-T01 to T06 |
| Grade scale table; Blue Wool 1-8 | Appendix C; P7-T03, T28 |
| Consumer card order, collapsed by default, expanded content, Hide method | Phase 7.9; P7-T21, T22, T26, T27 |
| Short and expanded summaries from the Addendum | C5 seed note |
| No PASS without a valid criterion; reviewer sign-off fields | Phase 7.8; P7-T19, T20 |
| Record shape fields (incl. method edition, criteria profile, description id) | A4.5 |
| Normal user cannot edit limits or methods; changes audited | P7-T17, P1-T24 |

### VAR: Color, Size, GTIN

| Requirement | Covered in |
|---|---|
| Three size systems with exact options; stable keys | A4.1, C5, Appendix C; P2-T01, T02 |
| Safe system change (Reset or Cancel, no silent mapping) | Phase 2.2; P2-T15 |
| Color count stepper, quick choices, configurable limit, Add / Remove | Phase 2.3; P2-T03, T23, T28 |
| Start with one card or Add Color prompt; new color has no sizes | P2-T27 |
| Duplicate color names need confirmation | P2-T26 |
| Per-color independent sizes; variant per color x size | Phase 2.5; P2-T05 to T08, T13, T14 |
| Deselect with GTIN confirms and archives; re-select restores | P2-T09 |
| GTIN as string; leading zero; labelled `Black / M - GTIN`; no generated GTIN | Phase 2.6; P2-T11, T29 |
| Duplicate GTIN check; check digit only when configured | P2-T12; A9 |
| Live counts derived, not incremented | P2-T07, T18 |
| Statuses Draft, GTIN Pending, Valid, Invalid, Archived | A4.2 |
| Zero variants blocked; color name required; incomplete draft marked | P2-T19, T24, T25 |
| Draft save and reload; reorder keeps GTINs on right color | Phase 2.8; P2-T16, T17 |
| Color images with order and alt text | A4.2, Phase 2.4; P2-T20 |
| Responsive and accessible labels | Design 8.6; P2-T22 |

### PKG: Packaging & Disposal

| Requirement | Covered in |
|---|---|
| Placement as 6.5 at the end of Care & Circularity | Phase 5.6 |
| Type dropdown (6), materials multi-select (7), recyclability (5) with exact options | A4.6, Appendix C; P5-T01, T02 |
| Other + Specify required only when Other | P5-T03 |
| Recycled content 0-100 or Not Available; no prefill; overall-value note | Phase 5.3; P5-T04 to T06, T13 |
| Recyclability not auto-set from material | P5-T09 |
| Instructions textarea with line breaks | P5-T07 |
| Required fields and inline errors | P5-T08 |
| Save Section and Cancel; reload | P5-T10, T15 |
| Consumer card shows saved fields, unknown = "Not available" | A8.3; P5-T14 |
| Keyboard, mouse, touch for all dropdowns | P5-T11 |

---

## Appendix B: Test catalog seed table (12 tests)

Source: Quality guide section 6 and the Addendum. Method references are setup suggestions only. The standards administrator confirms edition, option, conditions and unit before a test is enabled (`editionVerified: false` until then). Collapsed and expanded summaries come verbatim from the Addendum.

| # | `testId` | Canonical name | Method catalog note | Result fields | Scale / unit |
|---|---|---|---|---|---|
| 1 | `colour_washing` | Colour Fastness to Washing | ISO 105-C06; procedure and edition chosen by lab or buyer | Colour change grade; staining grade(s); test procedure; wash conditions if reported | Grey scale 1-5 (half grades) |
| 2 | `colour_perspiration` | Colour Fastness to Perspiration (Sweat) | ISO 105-E04 or buyer method; confirm edition and options | Acidic/alkaline condition; colour change grade; staining grade(s); method/edition | Grey scale 1-5 |
| 3 | `colour_rubbing` | Colour Fastness to Rubbing | ISO 105-X12; confirm procedure | Dry grade; wet grade; direction/area if reported | Grey scale 1-5 |
| 4 | `colour_light` | Colour Fastness to Light | ISO 105-B02 or applicable method; confirm edition and exposure option | Blue Wool rating or report-defined result; exposure method/option | Blue Wool 1-8 |
| 5 | `colour_saliva` | Colour Fastness to Saliva | DIN 53160-1 or buyer method; lab confirms suitability and edition | Reported colour-change/staining result, scale, method, conditions | Report-defined |
| 6 | `colour_hot_pressing` | Colour Fastness to Hot Pressing | ISO 105-X11 or buyer method; confirm condition and edition | Condition (dry/damp/wet); colour-change grade; staining grade(s) | Grey scale 1-5 |
| 7 | `tear_off_small_parts` | Tear-Off Force of Small Parts | Applicable child-product standard, buyer protocol or lab method; no universal ISO method or limit | Component/location; force; test setup/direction; requirement and source | N |
| 8 | `press_stud_opening` | Opening Force of Press Studs | Applicable press-stud/buyer method; lab confirms setup | Opening force; fastener location/type; method/setup; criterion source | N |
| 9 | `zipper_strength` | Zipper Strength | Applicable zipper standard or buyer protocol; configure exact method and property | Property tested; force where applicable; zipper location/type; method and criterion | N |
| 10 | `abrasion` | Abrasion Resistance | ISO 12947 series (Martindale); select part and endpoint | Cycles to endpoint and/or appearance rating; method part; endpoint | Cycles / rating |
| 11 | `dimensional_stability` | Dimensional Stability to Washing | ISO 5077 with specified wash/dry procedure; configure the combination | Length change %; width change %; wash/dry procedure; sign convention | % (signed) |
| 12 | `pilling` | Pilling Resistance | ISO 12945 series; select part/apparatus and assessment stage | Pilling grade and/or cycles; method part; assessment stage | Grade / cycles |

---

## Appendix C: Exact lists, labels and seed content from the guides

### C.1 Dropdown lists

| List | Options |
|---|---|
| Fabric type (11) | Single Jersey; Rib; Interlock; Pique; Fleece; French Terry; Woven Plain Weave; Woven Twill; Woven Satin; Denim; Other |
| Fiber type (16) | Cotton; Organic Cotton; Recycled Cotton; Polyester; Recycled Polyester; Elastane (Spandex); Nylon / Polyamide; Viscose; Modal; Lyocell; Acetate; Linen / Flax; Wool; Silk; Acrylic; Other |
| Trims and accessories (17) | Sewing Thread; Main Label; Care Label; Size Label; Hangtag; Button; Zipper; Snap / Fastener; Drawcord; Elastic; Interlining; Embroidery; Print; Applique; Shoulder Tape; Waistband; Other |
| Yarn type | Ring Spun; Open End / Rotor Spun; Compact Spun; Air-Jet Spun; Other; Unknown |
| Printing status | Performed; Not performed; Unknown |
| Packaging type (6) | Individual Polybag; Paper Packaging; Carton Packaging; Reusable Packaging; Polybag + Carton; Other |
| Packaging material (7) | LDPE; HDPE; PP; Paper; Corrugated Cardboard; Recycled Plastic; Other |
| Recyclability (5) | Recyclable; Non-recyclable; Conditionally Recyclable; Reusable; Not Available |
| Record type (6) | Certification; Audit/Assessment; Programme; Management System; Legal/Statutory; Product Test/Requirement |
| Category (8) | Material/Product; Environmental; Quality; Social/Labour; Safety; Security; Legal; Other |
| Applicable to (9) | Facility; Building; Fibre; Yarn; Fabric; Process; Garment/Product; Supply-chain claim; Other |
| Tier / stage (6) | Tier 1 (cutting, sewing/garment finishing); Tier 2 (knitting, dyeing, fabric finishing); Tier 3 yarn; Tier 4 fibre; Whole facility; Finished product |
| Evidence type | Certificate; Audit; Lab report; Permit; Official URL; Other |
| Verification method | Document review; Issuer lookup; Third-party audit; Lab report review; Owner confirmation; Not verified |
| Overall compliance result (lab) | Pass; Fail; Conditional Pass; Not Tested |

### C.2 Certification catalog (16)

01 LEED Gold; 02 BCI / Better Cotton; 03 GOTS; 04 OCS; 05 RCS; 06 GRS; 07 Fairtrade (scheme-specific); 08 OEKO-TEX STANDARD 100; 09 ISO 9001:2015; 10 International Accord / RSC; 11 amfori BSCI; 12 Sedex / SMETA; 13 Better Work Bangladesh; 14 RMG Sustainability Council (RSC); 15 CTPAT; 16 WRAP.

### C.3 Starter substances (11)

| Substance | CAS handling | Typical component |
|---|---|---|
| Formaldehyde | 50-00-0 | Fabric / garment |
| APEO / NPEO | Group; multiple CAS | Wet processing |
| Extractable heavy metals | Group; individual metals have CAS | Dyes, pigments, trims |
| PFAS | Group; multiple CAS | Functional finishes |
| Phthalates | Group; individual CAS | Print / plasticized parts |
| Azo colourants / restricted aromatic amines | Group; individual entries | Dyed textile |
| PAHs | Group; multiple | Rubber / plastic |
| Organotin compounds | Group; multiple | Applicable coatings/components |
| Chlorinated phenols (e.g. PCP) | PCP 87-86-5; others separately | Textiles |
| DMF | 68-12-2 | Certain coated materials |
| Chlorinated paraffins | Group; multiple | Applicable plastic/rubber |

For groups the UI shows "Multiple - see substance list" and links the individual entries. "Multiple" is never stored as a CAS number.

### C.4 Grey-scale interpretation aid (tests that use the grey scale only)

| Grade | Meaning |
|---|---|
| 5 | Excellent |
| 4-5 | Very good |
| 4 | Good |
| 3-4 | Fairly good |
| 3 | Fair |
| 2-3 | Poor to fair |
| 2 | Poor |
| 1-2 / 1 | Very poor |

### C.5 Traceability exact UI text

| Item | Text |
|---|---|
| Tier 1 prompt | How are Tier 1 processes performed? |
| Tier 2 prompt | How are Tier 2 processes performed? |
| Same option | All processes at the same factory |
| Different option | Processes at different factories |
| Mixed option | Some processes at the same factory, others at different factories |
| Facility add | + Add Another Facility |
| Yarn add | + Add Another Yarn Manufacturer |
| Remove | Remove |
| Summary heading | Review Manufacturing Summary |
| Draft / final actions | Save Draft; Back; Review & Save / Continue |
| Process identifiers (fixed) | cutting, sewing, garment_finishing, knitting, dyeing, printing, fabric_finishing |

### C.6 Demo certification records

Removed by decision. No demo or mock records are seeded. The six sample records in the Certification guide are used only as test fixtures.

### C.7 Error and empty messages (verbatim)

- "Add at least one fiber to describe the main fabric."
- "No trims or accessories added yet."
- "Grid + Solar percentage must equal 100%."
- "Result recorded - criterion not configured" (REVIEW REQUIRED)
- Public cards: "Report provided" for labs without accreditation evidence; "Not available" for unknown packaging fields.

---

## Appendix D: Plan items not required by any guide

These are implementation choices or carry-overs from the earlier plan. No guide asks for them and none contradicts a guide. Remove any of them if you want a strict guide-only build.

| Item | Where |
|---|---|
| Dropping `Draft / Complete / Verified` and the verifier role (single-admin decision; admin save = verified). Departs from the Materials, Quality and Certification guides, documented as a prototype limitation | A3.2, A7 |
| Dropping the Expired status, the expiry cron, the Pending Verification workflow, the Demo-data watermark and seeded emission factors (by decision) | A4.8, A4.7, A8.3 |
| Review page with Publish / Unpublish | A7, Phase 9 |
| Public URL with random short code, ISR revalidation, public JSON API, rate limits, scan counter, variant-level QR | A8, Phase 9 |
| Cloudinary storage with signed uploads and private signed URLs (the guides only say "secure file storage") | A5 |
| Single admin role also publishes and unpublishes | A7, Phase 9 |
| Collapsible sector UI (3 levels), expand/collapse all, deep links | A8A, Phase 1.6 |
| Facility registry shared by Traceability and Certification | A4.4 |
| Product model fields `buyerBrand`, `publishedSlug`, status `Published` | A4.2 |
| Emission factors must be entered by admin with source and year; none seeded (the guide's 0.50 is illustrative) | A4.7, Phase 6 |
