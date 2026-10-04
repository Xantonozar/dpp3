# Garment DPP — Digital Product Passport

Single-admin DPP for garments + public QR page. Spec: `DPP_Complete_Plan_single_admin.md` (phases 0–10; 8 guide PDFs win on conflict).

## Stack

Next.js 15 App Router · TypeScript · Mongoose · Cloudinary · Auth.js (credentials+JWT) · Zod · React Hook Form · Vitest + mongodb-memory-server · Playwright. Light-green Tailwind v4 theme (`app/globals.css`).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill MONGODB_URI, NEXTAUTH_SECRET, Cloudinary keys
npm run migrate              # syncIndexes
npm run seed                 # dropdowns + size systems (never emission factors/demo data)
ADMIN_EMAIL=a@x.com ADMIN_PASSWORD=secret npm run create-user
npm run dev                  # http://localhost:3000
```

## Commands

| cmd | what |
|---|---|
| `npm run dev / build / start` | run / production build / serve |
| `npm run lint` → `npm run typecheck` → `npm run test` | CI order (`.github/workflows/ci.yml`) |
| `npm run test:e2e` | Playwright (`tests/e2e`) |
| `npm run format` | Prettier + Tailwind plugin |

## Rules that matter

- **Single admin only.** `middleware.ts` + `requireAdmin()` in every handler. No sign-up route.
- **GTIN = string** (leading zeros), never generated. **Composition = 100 ±0.01** server-enforced. `grid+solar = 100`.
- **Seed zero emission factors** — admin enters each with `source` + `yearVersion` or no carbon is computed.
- **PASS/FAIL only** with compatible criterion; else `REVIEW REQUIRED`. No `Expired` cert status. UI delete = archive.
- **Public page reads `PublishedDpp` snapshot only**, keyed by nanoid `shortCode`. No demo data in prod DB.
- Every sector collapsible (`CollapsibleSection`), public uses `<details>` (no-JS safe).

## Env

`MONGODB_URI, NEXTAUTH_URL, NEXTAUTH_SECRET, APP_ENV=dev|staging|prod, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_SITE_URL`

Docs: `docs/ADMIN_GUIDE.md` (entry → QR walkthrough), `docs/DEPLOY.md` (environments, release order, smoke, pilot). E2E needs a running server: `PLAYWRIGHT_BASE_URL=… SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run test:e2e`.
