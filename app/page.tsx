import Link from "next/link";

const SECTORS = [
  { n: "01", t: "Variants", d: "Colors, sizes & GTINs" },
  { n: "02", t: "Materials", d: "Fabric composition 100%" },
  { n: "03", t: "Traceability", d: "Tier 1–3 factories & yarn" },
  { n: "04", t: "Quality", d: "Lab reports & RSL results" },
  { n: "05", t: "Packaging", d: "Packaging & disposal" },
  { n: "06", t: "Environment", d: "Energy & carbon footprint" },
  { n: "07", t: "Certification", d: "Registry & compliance" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-forest-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-forest-700 text-lg font-black text-white shadow-sm">
              ◈
            </span>
            <div>
              <p className="text-[15px] font-extrabold tracking-tight text-forest-950">
                Garment DPP
              </p>
              <p className="text-xs font-medium text-forest-800/60">
                Digital Product Passport · single-admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-forest-100 text-forest-800">
              <span className="size-1.5 rounded-full bg-forest-500" />
              Phase 0 · skeleton
            </span>
            <Link href="/login" className="btn-primary !py-2">
              Admin login
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="badge bg-white text-forest-700 ring-1 ring-forest-200">
              🌱 Light-green theme · mobile-first · QR-ready
            </p>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight text-forest-950 sm:text-6xl">
              Every garment,
              <br />
              <span className="text-forest-600">a passport.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-forest-900/70 sm:text-base">
              One admin enters verified data across 7 sectors. Consumers scan
              a QR code and see a clean, collapsible product page — materials,
              factories, lab results, carbon and certificates. No login
              needed.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary">
                Open admin console →
              </Link>
              <Link href="/api/health" className="btn-secondary">
                Check API health
              </Link>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                ["7", "sectors"],
                ["100%", "verified by admin"],
                ["QR", "public page"],
              ].map(([v, l]) => (
                <div key={l} className="card p-4 text-center">
                  <dt className="text-2xl font-black text-forest-800">{v}</dt>
                  <dd className="text-xs font-semibold text-forest-900/60">
                    {l}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* phone mock */}
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-[2rem] border border-forest-100 bg-white p-3 shadow-[0_24px_60px_-24px_rgba(31,64,44,0.35)]">
              <div className="rounded-[1.5rem] bg-mint-50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-forest-800">
                    ORGANIC TEE · TSH-001
                  </p>
                  <span className="badge bg-forest-700 text-white">
                    ✓ Verified
                  </span>
                </div>
                <div className="mt-3 h-36 rounded-2xl bg-gradient-to-br from-forest-200 via-forest-100 to-white ring-1 ring-forest-100" />
                {[
                  ["Materials", "Cotton 95% + Elastane 5% · 180 g/m²"],
                  ["Carbon", "0.351 kg CO₂e / garment"],
                  ["Quality", "12 tests · 11 PASS"],
                ].map(([t, s]) => (
                  <div key={t} className="mt-2 rounded-xl bg-white p-3 ring-1 ring-forest-100">
                    <p className="text-xs font-extrabold text-forest-900">
                      {t}
                    </p>
                    <p className="text-xs text-forest-900/60">{s}</p>
                  </div>
                ))}
                <div className="mx-auto mt-4 grid size-24 place-items-center rounded-2xl bg-forest-950 text-white">
                  <span className="text-[10px] font-bold">QR · /p/…</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* sectors */}
        <h2 className="mt-16 text-lg font-extrabold tracking-tight text-forest-950">
          The 7 passport sectors
        </h2>
        <p className="text-sm text-forest-900/60">
          Each sector is collapsible (3 levels) in admin and public views.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTORS.map((s) => (
            <div key={s.n} className="card group p-5 transition hover:-translate-y-0.5">
              <p className="text-xs font-black tracking-widest text-forest-500">
                {s.n}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-forest-950">
                {s.t}
              </p>
              <p className="text-sm text-forest-900/60">{s.d}</p>
            </div>
          ))}
          <div className="card grid place-items-center border-dashed bg-forest-50/50 p-5 text-center">
            <p className="text-sm font-bold text-forest-700">
              + Publish → QR page
              <br />
              <span className="font-medium text-forest-900/60">
                snapshot · versioned · rate-limited
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
