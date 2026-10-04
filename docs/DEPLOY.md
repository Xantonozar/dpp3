# Deployment

## Environments

| Item | dev | staging | prod |
|---|---|---|---|
| `APP_ENV` | `dev` | `staging` | `prod` |
| MongoDB Atlas | dev cluster/DB | staging DB | prod DB |
| Cloudinary folder | `dpp/dev/…` | `dpp/staging/…` | `dpp/prod/…` |
| `NEXT_PUBLIC_SITE_URL` | localhost | staging URL | prod URL |

Separate Atlas databases and Cloudinary folders per `APP_ENV`. No cron jobs exist
(certificates have no expiry job by design). Enable **Atlas backups + alerts** and
watch Vercel logs.

## Release order (every environment)

```bash
npm ci
npm run lint && npm run typecheck && npm run test   # CI gate
npm run migrate   # syncIndexes; autoIndex is off in prod
npm run seed      # catalogs only: dropdowns, sizes, 12 tests, 11 substances, 16 standards
ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-user   # single admin, bcrypt-hashed
npm run build && npm run start
```

Vercel: set all vars from `.env.example` (`MONGODB_URI`, `NEXTAUTH_URL/SECRET`,
`APP_ENV`, Cloudinary keys, `NEXT_PUBLIC_*`). Preview deploys per PR; promote to
prod after the smoke below.

## Smoke test (P10-T11)

```bash
PLAYWRIGHT_BASE_URL=<url> SMOKE_EMAIL=<admin> SMOKE_PASSWORD=<pw> npm run test:e2e
```

Covers: auth gate (root → login, API 401), login → products flow, small-screen
overflow. Verified locally against `next start` + real MongoDB: 10/10 green
(desktop + mobile).

## Pilot (Phase 10.9, manual)

Enter one real product from factory BOM + lab report: no example values, every
value with a data source, emission factors with source + year before publishing.
Confirm the public page matches saved data, then scan the printed QR.

## Open decisions (plan C6 — confirm before scaling)

Multi-tenant `orgId`? GTIN scope per-product vs global? First RSL profiles and
method editions? Care 6.1–6.4 scope? Emission-factor source/year? Public
GTIN/facility visibility? Search indexing (default noindex)? Per-variant QR?
