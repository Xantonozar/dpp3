# AGENTS.md — Garment DPP

Greenfield repo. Only `DPP_Complete_Plan_single_admin.md` exists — it is the build spec. No code, no manifests, no CI yet.

Status (Oct 2026): Phases 0–9 implemented, 70 unit + 10 e2e green; Phase 10 hardening in progress. Test with `npm run test` (Vitest+memory-server), e2e needs a live server (`PLAYWRIGHT_BASE_URL` + `SMOKE_*`). This machine's build/test workers are flaky — retry or run detached via `cmd /c … > log` on native crashes (exit 3221225477, IPC disconnects); failures are environmental, not code, when isolated reruns pass.

## Source of truth
- Plan file: `DPP_Complete_Plan_single_admin.md` (Parts I+II+III, Appendices A–D). Where plan and an 8-guide PDF differ, the guide wins (Appendix A maps coverage; Appendix D lists plan-only extras).
- Stack (fixed): Next.js App Router + TypeScript, Mongoose, Cloudinary, Auth.js credentials+JWT, Zod shared client+server, React Hook Form, Vitest + mongodb-memory-server, Playwright.
- Build order: Phases 0–10 in order; a phase is done only when its Test Gate passes (`P<phase>-T<n>` IDs). Regression checklist + bug rules (Critical/Major block gate) are in Part II footer.

## Structure to create (A1/A2)
- `app/(admin)/products/[productId]/{variants,materials,traceability,quality,packaging,environmental,certification,review}` + `app/p/[code]` (public) + `app/api/...` Route Handlers; `lib/{db,models,validators,services,calc}`; `components/ui/CollapsibleSection`; `scripts/{seed,migrate,create-user}.ts`; `middleware.ts`.
- One collection per module linked by `productId`; repeatable rows are embedded subdocs; Variants is a separate collection.

## Rules agents get wrong
- **Single admin:** only role is `admin`; admin save = verified. No Draft/Complete/Verified workflow, no `/verify`, no sign-up route (seed via `scripts/create-user.ts`). `middleware.ts` blocks everything except `/login`, `/p/*`, `/api/public/*`, `/api/auth/*`, AND every handler calls `requireAdmin()`.
- **Mongoose:** cached `dbConnect` (global), `mongoose.models.X || mongoose.model(...)` guard, `autoIndex:false` in prod with `Model.syncIndexes()` in `scripts/migrate.ts`. Use partial unique indexes for variants (`{productId,colorId,sizeKey}` and `{productId,gtin}` active-only) — never stored counters, use `countDocuments`.
- **GTIN:** string, trim-only, keeps leading zeros; never generated. Duplicate check before commit; archive/restore via `archivedGtin` on deselect.
- **Materials:** composition must total 100 ±0.01 to save (server 422); `elastane == spandex` canonical duplicate check; `Other` requires specify text.
- **Environmental:** seed ZERO emission factors; admin must enter each with `source` + `yearVersion` or carbon is not computed (guard message in Phase 6.8). Snapshot factor into record; recalculation is explicit. `gridShare + solarShare == 100` exact. Fixture `0.17kg/85% → 0.20kg → 1.08kWh → 0.351kg CO2e (0.50/0)` is test-code only.
- **Quality:** `testEvaluator` returns PASS/FAIL only with compatible criterion+unit+method; else `REVIEW REQUIRED` + "Result recorded - criterion not configured". Light fastness = Blue Wool 1-8, others grey 1-5 (half grades). ND keeps `reportingLimit`, never zero. `reportNumber` is a string. Groups show "Multiple - see substance list", never store "Multiple" as CAS. RSL limits editable only in admin catalog screen (+ audit), frozen per-result as `criterionSnapshot`.
- **Certification:** no `Expired` status, no expiry cron — `expiryDate` is display-only. Compliant needs `requirementName` + `assessmentDate`. Duplicate cert ID+issuer+site = warning, not block. UI delete = archive (`archivedAt`), counters exclude archived via live aggregation. No logos; facility cert always shows scope text.
- **Publish/public:** QR page reads `PublishedDpp` snapshot (whitelisted fields only), keyed by random 10-char nanoid `shortCode` (never `productId`). Republish = same URL, `version+1` + `revalidateTag`. Unpublish/invalid = 410/404 friendly page. Public API `GET /api/public/[code]` is read-only + rate-limited (~60/min/IP); public writes return 405.
- **Uploads:** browser → Cloudinary direct via `POST /api/cloudinary/sign` purpose policy (type/size/folder `dpp/{env}/...`); files never pass through Next.js; Mongo stores only `Asset` metadata. Private PDFs/evidence = `authenticated` + short-lived signed URL after admin check. Verify upload server-side via Admin API.
- **No demo data in prod DB.** Guide examples (95/5, 180gsm, 0.50 factor, 6 sample certs, TSH-001) are automated-test fixtures only. Catalog seeds: dropdowns, size systems (exact options in C5), 12 tests, 11 substances, 16 certs — emission factors excluded.
- **Collapsible UI (A8A):** one `CollapsibleSection` (levels 1–3), header = button with chevron + summary + error dot, `localStorage` state, `#hash` deep-link, auto-expand on error, lazy-render collapsed, print expands all. Public page uses native `<details>` so it works with JS disabled. Every new sector must be collapsible (Definition of Done). UI sub-sector numbers follow their parent sector (Quality 4.1–4.3, Packaging 5.1) — not the guides' original numbers (5.1–5.3, 6.5).

## Commands / env
- Phase 0 defines tooling: Next.js TS + ESLint + Prettier + Vitest + Playwright, `GET /api/health` (db status), GitHub Actions lint→typecheck→test, Vercel preview. Test types: U=Vitest, I=Vitest+memory-server, E=Playwright, M=manual, S=security.
- Env: `MONGODB_URI, NEXTAUTH_URL/SECRET, APP_ENV=dev|staging|prod, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_SITE_URL`. Separate Atlas DB + Cloudinary folder per `APP_ENV`; no cron jobs; Atlas backups on.
- Open decisions (C6, confirm before build): multi-tenant `orgId`? GTIN scope (per-product vs global)? first RSL profiles/method editions? Care 6.1–6.4 scope? emission-factor source/year? public GTIN/facility visibility? search-engine indexing (default noindex)? per-variant QR?
