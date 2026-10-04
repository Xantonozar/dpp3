# Admin guide — one product from entry to QR

Single admin, no sign-up. If you can log in, every save you make counts as verified.

## 1. Setup (once per environment)

```bash
cp .env.example .env.local   # fill values, see README
npm run migrate              # builds indexes (Model.syncIndexes)
npm run seed                 # dropdowns, size systems, 12 tests, 11 substances, 16 standards
ADMIN_EMAIL=you@org.com ADMIN_PASSWORD='<strong>' npm run create-user
```

Never seed emission factors, demo products, or certificates — prod starts empty.

## 2. Enter a product

1. **Products → New product** (ID like `TSH-001`, name, style no.).
2. **01 Variants**: pick the size system (changing it later archives variants —
   confirm Reset or Cancel, sizes are never auto-mapped). Add colors, tick sizes
   per color, enter GTINs exactly as printed (leading zeros kept, never generated).
   Colors can carry images (JPG/PNG/WebP ≤ 5 MB).
3. **02 Materials**: choose fabric type, add fiber rows until the live total reads
   **100% Valid** (elastane and spandex count as one fiber), optional GSM in g/m²,
   trims via *Select Component → Add Component*. Record the data source.
4. **03 Traceability**: origin/destination (destination may be *Not specified*),
   Tier 1/2 facility groups with *Same / Different / Mixed*, printing status,
   Tier 3 yarn cards (min one). *Save Draft* tolerates gaps; *Review & Save*
   enforces process assignment.
5. **04 Quality**: add the lab report first (report number kept verbatim, PDF stays
   private). Then chemical results (ND keeps its reporting limit, never 0) and
   physical tests (grey 1–5 half grades; light fastness uses Blue Wool 1–8).
   Without a matching RSL criterion a result saves as **REVIEW REQUIRED** — that
   is honest, not an error. Toggle *Publish* per result to show it on the QR page.
6. **05 Packaging (6.5)**: type, materials, recycled % (*Not Available* is not 0),
   recyclability (never auto-set), disposal instructions.
7. **06 Environment**: Admin → Emission factors first (grid + solar, each with
   source and year — carbon cannot compute without both). Then enter weights and
   energy; *6.4 How was it calculated?* shows the 7-step breakdown. Saved records
   snapshot the factors; editing a factor never rewrites history.
8. **07 Certification**: pick the standard (selecting it sets no status), fill the
   scope (always shown, also for facility certificates), dates (expiry is
   display-only), evidence (file stays private unless you approve it for public).
   Duplicate certificate ID + issuer + site warns instead of blocking.
   UI delete archives — history is kept.

## 3. Publish

**Review page** shows all 7 sectors with missing items. Variants (≥1) and Materials
(100%) are required; the rest ride along when present. **Publish** mints one
stable `/p/<code>` URL + QR (SVG for print at ≥ 2×2 cm, PNG for digital).
Republish keeps the URL and bumps the version. **Unpublish** keeps the QR
resolving to a “no longer available” page.

## 4. Limits to know (thesis prototype)

- You enter *and* attest the data (“Verified” = admin-attested, not independently reviewed).
- Public pages show published snapshots only, omit GTINs, and default to `noindex`.
