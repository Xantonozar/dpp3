# Streamlined 12-Group Chemical & RSL Compliance Module

A dedicated, streamlined chemical compliance system for garments based on the top 12 restricted substance groups, providing automatic requirement display, 3-state status selection (`PASS`, `FAIL`, `NOT VERIFIED`), and consumer-transparent passport rendering.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design choices were confirmed via interactive clarification:
> - **Pre-population**: All 12 substance groups will be pre-populated in the product's Chemical & RSL list so admins can quickly verify and select their status without adding them one-by-one.
> - **Initial State**: Each substance group defaults to `NOT VERIFIED` until explicitly evaluated as `PASS` or `FAIL`.
> - **Zero-Value Input**: Admins do not need to type numerical lab values or test methods; they only manage the compliance status.
> - **Consumer Visibility**: Public passport consumers see the substance group name, regulatory requirement summary, and clear compliance status badge.

---

## 1. Overview & Core Concept

### What It Does
Replaces manual numeric lab result entry in the Chemicals & RSL section with a streamlined compliance checklist covering the top 12 garment restricted substance groups. Selecting or viewing a substance group automatically renders its verified typical requirement (REACH, OEKO-TEX, AFIRM, POPs, CPSIA). Admins update the status via a single 3-option dropdown (`PASS`, `FAIL`, `NOT VERIFIED`).

### Target Audience & Persona
- **Brand / Quality Admin**: Efficiently records chemical compliance without dealing with complex unit conversions or CAS limit tables.
- **Consumer / Verifier**: Scans the garment QR code and immediately sees which restricted chemicals were tested and passed international garment safety standards.

---

## 2. User Experience & Visual Design

### The 12 Top Restricted Substance Groups & Requirements
| # | Substance Group | Typical Requirement |
|---|---|---|
| 1 | **Azo dyes releasing carcinogenic aromatic amines (22 amines)** | ≤30 mg/kg per amine (REACH Annex XVII, entry 43) |
| 2 | **Formaldehyde** | Baby/child ≤16 mg/kg; skin contact ≤75 mg/kg; outerwear ≤300 mg/kg (OEKO-TEX, AFIRM) |
| 3 | **Heavy metals (Pb, Cd, Hg, As, Cr(VI), Ni)** | Lead in accessories ≤500 mg/kg (EU) or ≤100 mg/kg (US); Cadmium ≤100 mg/kg; Cr(VI) in leather ≤3 mg/kg; Nickel release ≤0.5 µg/cm²/week |
| 4 | **Phthalates (DEHP, DBP, BBP, DIBP, DINP, DIDP, DNOP)** | ≤0.1% (1,000 mg/kg) in plasticised parts such as prints, PVC and coatings |
| 5 | **PFAS (PFOS, PFOA, C9–C14 PFCAs, PFHxA)** | PFOA ≤25 ppb; PFOS ≤1 µg/m²; PFHxA ≤25 ppb (sum), related substances ≤1,000 ppb |
| 6 | **Alkylphenols and ethoxylates (NP/NPEO, OP/OPEO)** | NPE ≤0.01% (100 mg/kg) in washable textiles (REACH entry 46a); brands require ≤10–100 mg/kg |
| 7 | **Chlorophenols (PCP, TeCP, TCP) & chlorinated organic carriers** | PCP typically ≤0.5 mg/kg (≤0.05 mg/kg for baby); chlorobenzenes/chlorotoluenes ≤1 mg/kg |
| 8 | **Organotin compounds (TBT, DBT, TPhT)** | ≤0.1% as tin in articles (REACH entry 20); OEKO-TEX: TBT ≤0.5 mg/kg, DBT ≤1 mg/kg |
| 9 | **Flame retardants (TRIS, TEPA, PBB, PBDEs, SCCPs)** | Banned in skin-contact textiles (REACH entries 4, 7, 8); SCCPs controlled under POPs |
| 10 | **Allergenic & carcinogenic disperse dyes (about 20 listed)** | Not detected (typically <50 mg/kg) |
| 11 | **PAHs (8 REACH PAHs)** | ≤1 mg/kg per PAH (0.5 mg/kg for toys and childcare), REACH entry 50 |
| 12 | **SVHC (REACH Candidate List)** | ≤0.1% w/w per article; communicate on request and notify ECHA where required |

### Admin User Flow
1. Admin navigates to **04 Quality** → **4.2 Chemicals & Restricted Substances (RSL)**.
2. A clean table/card list displays all 12 pre-populated substance groups.
3. Each item displays:
   - Substance Group Name & Index (1–12)
   - Automatically displayed regulatory requirement box
   - **Status Dropdown**:
     - `PASS` (Green badge)
     - `FAIL` (Red badge)
     - `NOT VERIFIED` (Neutral / amber badge)
4. Admin can also select "Mark All as PASS" quick action button or adjust individual statuses with immediate auto-save or "Save Changes".

### Public Consumer Passport Flow (`/p/[code]`)
1. Consumer opens the public passport and clicks **Chemicals & RSL**.
2. Displays a summary card (e.g. *12 Substance Groups Evaluated · 12 PASS*).
3. Expandable list showing each substance group, its regulatory standard requirement, and its status badge (`PASS` / `FAIL` / `NOT VERIFIED`).

---

## 3. Key Product Decisions & Trade-Offs

- **Pre-populated vs. Dynamic Add**: Pre-populating all 12 items eliminates tedious dropdown selection cycles, ensuring consistency across every garment passport.
- **3-State Status Enum**: Using explicit `PASS`, `FAIL`, and `NOT VERIFIED` provides full transparency to consumers without ambiguity or false claims.
- **Backward Compatibility**: Existing physical and colour fastness tests in Section 4.1 remain intact while 4.2 focuses directly on the standardized 12 RSL groups.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Top 12 RSL Standards Catalog              │
│       (Pre-defined standard requirements & group names)      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  Admin Quality Section (4.2)                 │
│  - 12 Pre-populated Substance Cards                          │
│  - Automatic Requirement Render                              │
│  - Status Selector: [PASS | FAIL | NOT VERIFIED]             │
│  - Quick Action: [Mark All as PASS]                          │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│               API & Mongoose Storage Layer                   │
│  - Product Quality Record: rslSubstances: [                  │
│      { code, name, requirement, status: PASS|FAIL|NOT_VERIF }│
│    ]                                                         │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Public QR Passport (`/p/[code]`)                │
│  - Clean consumer table with Status badges and requirements  │
└──────────────────────────────────────────────────────────────┘
```

### Component & Entity Mapping
1. **Catalog Definition (`lib/constants/rsl-standards.ts`)**: Defines the 12 substance groups, IDs, full names, and official requirements.
2. **Quality Model & Validator (`lib/models/Quality.ts` & `lib/validators/quality.ts`)**: Ensures storage of the 12 items with strict status validation (`PASS` | `FAIL` | `NOT VERIFIED`).
3. **Admin Component (`components/product/QualitySection.tsx`)**: Replaces old complex CAS search in 4.2 with the streamlined 12-group card layout and status selectors.
4. **Public Passport (`app/p/[code]/page.tsx`)**: Renders the 12 substance compliance cards with accessible status styling.
