import type { Metadata } from "next";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { TakeTourButton } from "@/components/TakeTourButton";

export const metadata: Metadata = { title: "Help — Garment DPP" };

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 text-sm font-extrabold text-forest-950 first:mt-0">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm leading-relaxed text-forest-900/75">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl bg-forest-950 px-4 py-3 text-xs leading-relaxed text-forest-100">
      {children}
    </pre>
  );
}

function Fix({ symptom, cause, fix }: { symptom: string; cause: string; fix: string }) {
  return (
    <tr>
      <td className="px-4 py-2.5 align-top text-xs font-bold text-forest-950">{symptom}</td>
      <td className="px-4 py-2.5 align-top text-xs text-forest-900/70">{cause}</td>
      <td className="px-4 py-2.5 align-top text-xs text-forest-900/70">{fix}</td>
    </tr>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-forest-950">Help</h1>
          <p className="text-sm text-forest-900/60">
            The full manual — start to finish, plus fixes for common errors. Every section is collapsible;
            the links in the app open straight to the right one.
          </p>
        </div>
        <TakeTourButton className="btn-primary !py-2 text-xs" />
      </div>

      <CollapsibleSection id="help-start" level={1} title="Getting started (once per environment)"
        summary="env, migrate, seed, create-user, login" defaultOpen>
        <H>1. Configure the environment</H>
        <P>
          Copy the template and fill in real values. Never commit <code className="font-mono">.env.local</code>.
        </P>
        <Code>{`cp .env.example .env.local   # MONGODB_URI, NEXTAUTH_SECRET, Cloudinary keys, APP_ENV`}</Code>

        <H>2. Build the database</H>
        <Code>{`npm run migrate    # creates/syncs indexes (autoIndex is off in production)
npm run seed       # dropdowns, size systems, 12 tests, 11 substances, 16 standards
                   # (emission factors are intentionally NOT seeded)`}</Code>

        <H>3. Create the admin account</H>
        <P>
          There is no sign-up route — accounts are seeded from the CLI, one admin at a time:
        </P>
        <Code>{`ADMIN_EMAIL=you@org.com ADMIN_PASSWORD='<strong>' npm run create-user`}</Code>

        <H>4. Run and log in</H>
        <Code>{`npm run dev        # development
npm run build && npm run start   # production`}</Code>
        <P>
          Open <code className="font-mono">/login</code>, sign in, and you land on the Products dashboard.
          Root (<code className="font-mono">/</code>) always redirects to login when signed out.
        </P>
      </CollapsibleSection>

      <CollapsibleSection id="help-workflow" level={1} title="Everyday workflow"
        summary="New product → 8 sections → save → publish → QR">
        <H>Create the product</H>
        <P>
          Products <b>→ + New product</b>. Only the ID is required (e.g. <code className="font-mono">TSH-001</code>
          — unique). Name and style number are optional but recommended.
        </P>

        <H>Fill the eight sections (top to bottom)</H>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-forest-900/75">
          <li><b className="text-forest-950">01 Variants</b> — pick the size system (changing it later archives
            colors/sizes — confirm Reset or Cancel; sizes are never auto-mapped), add colors, tick sizes, enter GTINs as-is.</li>
          <li><b className="text-forest-950">02 Materials</b> — fibers must total 100 ±0.01 to save; “Other” needs a
            specify note; elastane and spandex are one fiber.</li>
          <li><b className="text-forest-950">03 Traceability</b> — origin (country, final factory), supply-chain tiers, yarn lots.</li>
          <li><b className="text-forest-950">04 Quality</b> — tests, substances and profiles; see “Quality & lab results” below.</li>
          <li><b className="text-forest-950">05 Packaging</b> — packaging type, materials, recyclability, disposal text.</li>
          <li><b className="text-forest-950">06 Environment</b> — energy shares, data source, carbon; see “Carbon” below.</li>
          <li><b className="text-forest-950">07 Certification</b> — facility/product certificates; Compliant needs
            requirement + assessment date. UI delete = archive.</li>
          <li><b className="text-forest-950">08 Review &amp; Publish</b> — readiness checklist, publish, QR.</li>
        </ol>

        <H>Saving</H>
        <P>
          Each section has its own save button at its <b>bottom</b>. Saving = verified — there is no separate
          approval step for a single admin. Server rejections appear as red messages that name the exact field
          (e.g. <i>compositionTotal: must total 100</i>); fix only the listed fields and save again.
        </P>
      </CollapsibleSection>

      <CollapsibleSection id="help-verdicts" level={1} title="Quality & lab results"
        summary="PASS / FAIL / REVIEW REQUIRED — what they mean and how to fix them">
        <div className="overflow-x-auto rounded-xl ring-1 ring-forest-100">
          <table className="w-full text-left">
            <thead className="bg-forest-50 text-[11px] uppercase tracking-wide text-forest-900/60">
              <tr><th className="px-4 py-2">Status</th><th className="px-4 py-2">Meaning</th></tr>
            </thead>
            <tbody className="divide-y divide-forest-50 bg-white text-xs">
              <tr><td className="px-4 py-2.5 font-bold text-forest-800">PASS</td>
                <td className="px-4 py-2.5 text-forest-900/70">Result meets the criterion in the selected RSL profile.</td></tr>
              <tr><td className="px-4 py-2.5 font-bold text-red-800">FAIL</td>
                <td className="px-4 py-2.5 text-forest-900/70">Result breaches the criterion.</td></tr>
              <tr><td className="px-4 py-2.5 font-bold text-amber-900">REVIEW REQUIRED</td>
                <td className="px-4 py-2.5 text-forest-900/70">No compatible rule was found — the result is recorded,
                  but no verdict could be derived. Publishable, but the card explains why.</td></tr>
              <tr><td className="px-4 py-2.5 font-bold text-forest-900/70">NOT TESTED / NOT APPLICABLE</td>
                <td className="px-4 py-2.5 text-forest-900/70">Explicit non-results (ND keeps the reporting limit, never zero).</td></tr>
            </tbody>
          </table>
        </div>

        <H>Why a result shows REVIEW REQUIRED</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-forest-900/75">
          <li><b>No profile selected</b> on the result card — pick the RSL profile before saving.</li>
          <li><b>Profile has no matching rule</b> — the profile’s criterion <code className="font-mono">refKey</code> must
            exactly match the result key (<code className="font-mono">apeo</code>,
            <code className="font-mono">formaldehyde</code>, <code className="font-mono">colour_rubbing</code>…).</li>
          <li><b>Unit mismatch</b> — criterion unit must equal the entered unit (<code className="font-mono">mg/kg</code> vs
            <code className="font-mono">g/kg</code> never matches).</li>
        </ul>

        <H>Results are frozen on save</H>
        <P>
          A saved result never re-evaluates — that keeps lab history stable. To re-evaluate: change the RSL profile
          (or its criteria as a new version in Quality catalogs), delete the result row, and enter it again.
          Profiles are versioned (<code className="font-mono">key + version</code>); create the corrected version under
          Quality catalogs → RSL profiles.
        </P>
      </CollapsibleSection>

      <CollapsibleSection id="help-carbon" level={1} title="Carbon & emission factors"
        summary="factors need source + year; grid + solar = 100%">
        <P>
          The app ships with <b>no emission factors</b> — you add each one with a documented source and
          year/version, or carbon stays uncalculated and section 06 shows the guard message
          <i>“Add an emission factor with source and year…”</i>.
        </P>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-forest-900/75">
          <li>Admin → <b>Emission factors</b>: both a <b>grid</b> and a <b>solar</b> factor are required.</li>
          <li><b>grid share + solar share must total exactly 100%</b> on the product — otherwise the section refuses to save.</li>
          <li>On save, the factor values are <b>snapped into the product record</b>. Editing a factor later never
            rewrites existing records — recalculation is explicit (re-save the Environmental section).</li>
          <li>The <i>How was it calculated?</i> expander on the public page shows the exact math (kWh → factor → CO₂e).</li>
        </ul>
      </CollapsibleSection>

      <CollapsibleSection id="help-publish" level={1} title="Publishing & the public page"
        summary="readiness gate, QR, republish, unpublish">
        <H>Publish gate</H>
        <P>
          Section <b>08 Review &amp; Publish</b> lists every requirement with a live status dot.
          <b>Variants (≥1) and Materials (100%) are mandatory</b>; the other sections publish what exists so far.
          When all dots are green, Publish makes the passport live.
        </P>
        <H>QR &amp; URL</H>
        <P>
          Publishing creates a random 10-character code — the public URL is
          <code className="font-mono"> /p/&lt;shortCode&gt;</code> (never the product ID). Download the QR under
          <b> QR Code</b>; print at ≈2×2 cm with a quiet zone and test-scan before mass printing.
        </P>
        <H>Republish / unpublish</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-forest-900/75">
          <li><b>Republish</b> after edits → <b>same URL</b>, version +1 (printed QRs keep working).</li>
          <li><b>Unpublish</b> → the QR opens a friendly “no longer available” (HTTP 410) page; re-publish restores it.</li>
          <li>Variant deep-links <code className="font-mono">?v=…</code> highlight a color/size on the public page.</li>
          <li>The public page is <b>noindex</b> (search engines are told not to index it), reads only whitelisted
            fields, and shows an exact version + published date in the footer.</li>
        </ul>
      </CollapsibleSection>

      <CollapsibleSection id="help-troubleshoot" level={1} title="Troubleshooting"
        summary="common errors and their exact fixes">
        <div className="overflow-x-auto rounded-xl ring-1 ring-forest-100">
          <table className="w-full text-left">
            <thead className="bg-forest-50 text-[11px] uppercase tracking-wide text-forest-900/60">
              <tr>
                <th className="px-4 py-2">Symptom</th>
                <th className="px-4 py-2">Cause</th>
                <th className="px-4 py-2">Fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50 bg-white">
              <Fix symptom="“must total 100% to save” on Materials"
                cause="Fiber percentages add up to ≠100 (tolerance ±0.01)."
                fix="Adjust the fibers; the Total line turns green only when valid." />
              <Fix symptom="“Duplicate: elastane is already listed”"
                cause="Elastane and spandex are the same canonical fiber."
                fix="Merge them into one row." />
              <Fix symptom="Result stuck on REVIEW REQUIRED"
                cause="No profile chosen, or profile refKey/unit doesn’t match the result."
                fix="Pick a profile whose criteria match — see “Quality & lab results” above." />
              <Fix symptom="Carbon missing / amber guard in 06 Environment"
                cause="No grid + solar emission factors, or a factor lacks source/year."
                fix="Admin → Emission factors: add both with source and year, then re-save." />
              <Fix symptom="GTIN save rejected as duplicate"
                cause="Another active variant already uses that GTIN."
                fix="Keep leading zeros as typed; archive the old variant or correct the number." />
              <Fix symptom="Changing the size system archived my colors"
                cause="By design — size mappings are never guessed."
                fix="Confirm Reset to rebuild, or Cancel to keep the old system." />
              <Fix symptom="Red API error names a field (e.g. “expiryDate: …”)"
                cause="Server-side validation rejected exactly that field."
                fix="Fix only the named field(s) — other values are fine." />
              <Fix symptom="Login loop / 401 on everything"
                cause="Wrong NEXTAUTH_URL/SECRET, or no user yet."
                fix="Match NEXTAUTH_URL to the origin (incl. port) and run create-user." />
              <Fix symptom="EADDRINUSE when starting"
                cause="Port 3000 already serves another project."
                fix="PORT=3001 set NEXTAUTH_URL=http://localhost:3001 — or stop the other server." />
              <Fix symptom="500 / “Cannot find module ./vendor-chunks/…”"
                cause="dev and build wrote to .next at the same time."
                fix="Stop both, delete .next, run npm run build once, start again." />
              <Fix symptom="Setup checklist never disappears"
                cause="Still missing an active RSL profile or emission factor."
                fix="Add both — the card checks live and hides itself when ready." />
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="help-tour" level={1} title="Tour & command cheat sheet"
        summary="replay the tour; day-to-day commands">
        <H>Tour</H>
        <P>
          Replay the dashboard tour with the button at the top of this page (or on Products). The product-page
          tour starts itself the first time you open any product. <b>Every section, sub-section and catalog card
          also has a small <span className="inline-grid size-[18px] place-items-center rounded-full border border-forest-200 align-middle text-[11px] font-black text-forest-700">?</span></b> —
          click it for a mini-tour that walks you through just that part.
        </P>
        <div className="mt-2">
          <TakeTourButton className="btn-primary !py-2 text-xs">Take the dashboard tour</TakeTourButton>
        </div>

        <H>Commands</H>
        <Code>{`npm run dev          # development server
npm run build        # production build (never while dev is running)
npm run start        # serve the build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest unit + integration (memory server)
npm run test:e2e     # playwright (needs PLAYWRIGHT_BASE_URL + running server)
npm run migrate      # Model.syncIndexes
npm run seed         # catalog seeds (idempotent)
ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-user`}</Code>

        <H>Environment variables</H>
        <P>
          <code className="font-mono">MONGODB_URI</code>, <code className="font-mono">NEXTAUTH_URL</code>,
          <code className="font-mono"> NEXTAUTH_SECRET</code>, <code className="font-mono">APP_ENV</code>
          (dev|staging|prod), Cloudinary keys (<code className="font-mono">CLOUDINARY_CLOUD_NAME</code>,
          <code className="font-mono"> CLOUDINARY_API_KEY/SECRET</code>,
          <code className="font-mono">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code>),
          <code className="font-mono"> NEXT_PUBLIC_SITE_URL</code>. Separate Atlas DB and Cloudinary folder per
          APP_ENV; no cron jobs exist.
        </P>
      </CollapsibleSection>
    </div>
  );
}
