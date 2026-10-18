import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { PublishedDpp } from "@/lib/models/PublishedDpp";
import { recordScan } from "@/lib/services/publish";
import { PublicControls } from "./controls";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  await dbConnect();
  const doc = (await PublishedDpp.findOne({ shortCode: code })
    .sort({ version: -1 })
    .lean()) as unknown as { active: boolean; snapshot: Snap } | null;
  if (!doc) notFound();
  const robots = { index: false, follow: false } as const;
  if (!doc.active) return { title: "Product Passport — unavailable", robots };
  const h = doc.snapshot.header;
  const fiber = doc.snapshot.materials?.fibers
    .map((f) => `${f.label} ${f.percentage}%`)
    .join(" + ");
  const carbon = doc.snapshot.environmental
    ? `${doc.snapshot.environmental.carbonKgCo2e} kg CO₂e per garment`
    : null;
  const description = [fiber, carbon].filter(Boolean).join(" · ") ||
    "Digital Product Passport with materials, origin, quality and environmental data.";
  return { title: `${h.name} — Digital Product Passport`, description, robots };
}

type Snap = {
  header: {
    name: string; productId: string; styleNo: string; productType: string; buyerBrand: string;
    brand?: string; season?: string; gender?: string;
    colors: { name: string; images: { url: string; alt: string }[] }[];
    sizes: { key: string; label: string }[];
    variants: { vid: string; color: string; size: string }[];
  };
  materials: null | {
    fabricType: string; fibers: { label: string; percentage: number }[];
    gsm: number | null; construction: string; trims: { label: string; material: string }[];
  };
  traceability: null | {
    origin: Record<string, string>;
    tiers: { tier: string; process: string; factory: string; location: string; note: string }[];
    yarn: {
      name: string;
      location: string;
      country: string;
      yarnType?: string;
      yarnCount?: string;
      composition?: string;
      referenceLot?: string;
    }[];
  };
  quality: { kind: string; name: string; [k: string]: unknown }[];
  packaging: null | { type: string; materials: string[]; recycledContent: string; recyclability: string; instructions: string };
  environmental: null | {
    totalEnergyKwh: number; gridEnergyKwh: number; solarEnergyKwh: number;
    gridSharePct: number; solarSharePct: number; carbonKgCo2e: number;
    factors: { grid: number; solar: number }; breakdown: string;
  };
  certification: {
    name: string; recordType: string; scope: string; tier: string; facility: string;
    status: string; outcome: string; requirement: string;
    issueDate: string; expiryDate: string; assessmentDate: string; evidenceUrl: string;
  }[];
};

function statusTone(s: string) {
  const v = (s ?? "").toLowerCase();
  if (v === "pass" || v === "compliant" || v === "verified") return "bg-forest-100 text-forest-800";
  if (v === "fail" || v === "non-compliant" || v === "rejected/invalid") return "bg-red-100 text-red-800";
  if (v === "review required" || v === "not assessed" || v === "conditional pass")
    return "bg-amber-100 text-amber-900";
  return "bg-stone-100 text-stone-700";
}

function Section({ id, title, summary, open, children }: { id: string; title: string; summary: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="card sec sec-l1 overflow-hidden" id={id} open={open}>
      <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span className="sec-tile grid size-8 shrink-0 place-items-center rounded-xl bg-forest-100 text-sm font-black text-forest-700">
            <span className="sec-plus">+</span>
            <span className="sec-minus">−</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-forest-950">{title}</span>
            <span className="block truncate text-xs font-medium text-forest-900/55">{summary}</span>
          </span>
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { code } = await params;
  const { v } = await searchParams;
  await dbConnect();
  const doc = (await PublishedDpp.findOne({ shortCode: code }).sort({ version: -1 }).lean()) as unknown as {
    productId: unknown;
    active: boolean;
    snapshot: Snap;
    version: number;
    publishedAt?: Date | string | null;
  } | null;
  if (!doc) notFound();
  if (!doc.active) {
    return (
      <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-4">
        <div className="card p-10 text-center">
          <p className="text-xs font-black tracking-widest text-forest-500">PRODUCT PASSPORT</p>
          <h1 className="mt-2 text-2xl font-black text-forest-950">This product passport is no longer available</h1>
          <p className="mt-2 text-sm text-forest-900/60">The QR code still resolves here, but the product has been unpublished.</p>
        </div>
      </main>
    );
  }
  void recordScan(String(doc.productId), code);
  const s = doc.snapshot;
  const h = s.header;
  const sel = v ? h.variants.find((x) => x.vid === v) : undefined;
  const origin = s.traceability?.origin;
  const heroImg = (sel ? h.colors.find((c) => c.name === sel.color)?.images[0] : undefined) ??
    h.colors[0]?.images[0];
  const publishedOn = doc.publishedAt
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(doc.publishedAt))
    : null;
  const navLinks: [string, string][] = [
    ["Materials", "#s-materials"],
    ...(s.traceability ? ([["Origin", "#s-traceability"]] as [string, string][]) : []),
    ...(s.quality.length ? ([["Quality", "#s-quality"]] as [string, string][]) : []),
    ...(s.packaging ? ([["Packaging", "#s-packaging"]] as [string, string][]) : []),
    ...(s.environmental ? ([["Carbon", "#s-environment"]] as [string, string][]) : []),
    ...(s.certification.length ? ([["Certs", "#s-certification"]] as [string, string][]) : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-forest-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <p className="truncate text-sm font-extrabold text-forest-950">{h.name}</p>
          <nav aria-label="Sections" className="flex gap-1 overflow-x-auto text-xs font-bold text-forest-700">
            {navLinks.map(([label, href]) => (
              <a key={href} href={href} className="rounded-lg px-2 py-1 hover:bg-forest-50">{label}</a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 pb-16 pt-6">
        <div className="card p-6">
          <p className="text-xs font-black tracking-widest text-forest-500">
            DIGITAL PRODUCT PASSPORT
            <span className="badge ml-2 bg-forest-100 align-middle text-forest-800">v{doc.version}</span>
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-forest-950">{h.name}</h1>
          <p className="mt-1 text-sm text-forest-900/60">
            {[h.brand || h.buyerBrand, h.productType, h.styleNo && `Style ${h.styleNo}`, h.season, h.gender].filter(Boolean).join(" · ")}
          </p>
          {heroImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImg.url} alt={heroImg.alt} className="mt-4 h-56 w-full rounded-2xl object-cover ring-1 ring-forest-100" />
          )}
          {(origin?.countryOfManufacture || s.environmental || s.quality.length > 0) && (
            <dl className="mt-4 flex flex-wrap gap-2 text-center">
              {origin?.countryOfManufacture && (
                <div className="min-w-36 flex-1 rounded-xl bg-forest-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-forest-900/55">Made in</dt>
                  <dd className="truncate text-sm font-extrabold text-forest-950">{origin.countryOfManufacture}</dd>
                </div>
              )}
              {s.environmental && (
                <div className="min-w-36 flex-1 rounded-xl bg-forest-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-forest-900/55">Carbon</dt>
                  <dd className="truncate text-sm font-extrabold text-forest-950">{s.environmental.carbonKgCo2e} kg</dd>
                </div>
              )}
              {s.quality.length > 0 && (
                <div className="min-w-36 flex-1 rounded-xl bg-forest-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-forest-900/55">Lab results</dt>
                  <dd className="truncate text-sm font-extrabold text-forest-950">{s.quality.length}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {h.variants.map((x) => {
              const active = sel?.vid === x.vid;
              return (
                <a
                  key={x.vid}
                  href={`?v=${x.vid}`}
                  aria-current={active ? "true" : undefined}
                  className={`badge transition ring-1 ${
                    active
                      ? "bg-forest-700 text-white ring-forest-700"
                      : "bg-forest-50 text-forest-800 ring-forest-100 hover:bg-forest-100"
                  }`}
                >
                  {x.color} · {x.size}
                </a>
              );
            })}
          </div>
          {sel && (
            <p className="mt-2 text-xs font-bold text-forest-700">
              Showing variant: {sel.color} · {sel.size} ·{" "}
              <a href="?" className="underline">show all</a>
            </p>
          )}
          <PublicControls code={code} />
        </div>

        <div id="s-summary">
          <Section id="s-summary-sec" title="Summary" summary={`${h.colors.length} color(s) · ${h.variants.length} variant(s)`} open>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {s.materials && <div className="rounded-xl bg-forest-50/70 p-3"><dt className="text-xs text-forest-900/60">Fabric</dt><dd className="font-bold">{s.materials.fibers.map((f) => `${f.label} ${f.percentage}%`).join(" + ")}</dd></div>}
              {s.environmental && <div className="rounded-xl bg-forest-50/70 p-3"><dt className="text-xs text-forest-900/60">Carbon</dt><dd className="font-bold">{s.environmental.carbonKgCo2e} kg CO₂e</dd></div>}
              {origin?.countryOfManufacture && <div className="rounded-xl bg-forest-50/70 p-3"><dt className="text-xs text-forest-900/60">Country of origin</dt><dd className="font-bold">{origin.countryOfManufacture}</dd></div>}
              {s.packaging && <div className="rounded-xl bg-forest-50/70 p-3"><dt className="text-xs text-forest-900/60">Packaging</dt><dd className="font-bold">{s.packaging.type}</dd></div>}
            </dl>
          </Section>
        </div>

        {s.materials && (
          <div id="s-materials">
            <Section id="s-materials-sec" title="Materials & Composition"
              summary={s.materials.fibers.map((f) => `${f.label} ${f.percentage}%`).join(" + ")}>
              <p className="text-sm"><strong>Type:</strong> {s.materials.fabricType}</p>
              <ul className="mt-1 text-sm">
                {s.materials.fibers.map((f, i) => <li key={i}>{f.label} — {f.percentage}%</li>)}
              </ul>
              {(s.materials.gsm != null || s.materials.construction) && (
                <p className="mt-1 text-sm text-forest-900/70">
                  {[s.materials.gsm != null ? `${s.materials.gsm} g/m²` : "", s.materials.construction].filter(Boolean).join(" · ")}
                </p>
              )}
              {s.materials.trims.length > 0 && (
                <p className="mt-2 text-sm"><strong>Trims:</strong> {s.materials.trims.map((t) => t.material ? `${t.label} (${t.material})` : t.label).join(", ")}</p>
              )}
            </Section>
          </div>
        )}

        {s.traceability && (
          <div id="s-traceability">
            <Section id="s-traceability-sec" title="Traceability & Origin" summary={`${origin?.countryOfManufacture ?? ""}${origin?.destinationCountry ? ` → ${origin.destinationCountry}` : ""}`}>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="label !mb-0">Country of origin / manufacture</dt><dd className="font-semibold text-forest-950">{origin?.countryOfManufacture || "—"}</dd></div>
                <div><dt className="label !mb-0">Destination</dt><dd className="font-semibold text-forest-950">{origin?.destinationCountry || "—"}{origin?.destinationMarket ? ` · ${origin.destinationMarket}` : ""}</dd></div>
              </dl>
              <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-forest-100">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead><tr className="bg-forest-50 text-xs uppercase text-forest-800">
                    <th className="px-4 py-2">Process</th><th className="px-4 py-2">Factory</th><th className="px-4 py-2">Location</th>
                  </tr></thead>
                  <tbody className="divide-y divide-forest-50 bg-white">
                    {s.traceability.tiers.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-semibold">{r.tier} · {r.process}</td>
                        <td className="px-4 py-2">{r.factory}{r.note ? ` (${r.note})` : ""}</td>
                        <td className="px-4 py-2">{r.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.traceability.yarn.length > 0 && (
                <div className="mt-3 border-t border-forest-100 pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-forest-800">
                    Tier 3 Yarn Manufacturers
                  </p>
                  <div className="mt-2 space-y-2">
                    {s.traceability.yarn.map((y, i) => (
                      <div key={i} className="rounded-xl bg-forest-50/70 p-3 text-xs text-forest-950 ring-1 ring-forest-100/60">
                        <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                          <span className="text-sm text-forest-950">{y.name}</span>
                          <span className="badge bg-forest-100 text-forest-800">{y.country}</span>
                        </div>
                        {y.location && <p className="mt-0.5 text-forest-900/60">{y.location}</p>}
                        {(y.yarnType || y.yarnCount || y.composition) && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-white/80 p-2 text-[11px] text-forest-900/80">
                            {y.yarnType && (
                              <span>
                                <strong className="text-forest-950">Yarn Type:</strong> {y.yarnType}
                              </span>
                            )}
                            {y.yarnCount && (
                              <span>
                                <strong className="text-forest-950">Yarn Count:</strong> {y.yarnCount}
                              </span>
                            )}
                            {y.composition && (
                              <span>
                                <strong className="text-forest-950">Composition:</strong> {y.composition}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}

        {s.quality.length > 0 && (
          <div id="s-quality">
            <Section id="s-quality-sec" title="Quality & Lab Testing" summary={`${s.quality.length} published result(s)`}>
              <div className="space-y-2">
                {s.quality.map((r, i) => (
                  <details key={i} className="rounded-xl bg-white ring-1 ring-forest-100">
                    <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase text-forest-700">
                          {r.kind === "chemical" ? "Chemical & RSL" : String(r.method ?? "Lab test")}
                        </span>
                        <span className={`badge font-bold ${statusTone(String(r.status))}`}>{String(r.status)}</span>
                      </span>
                      <span className="mt-1 block text-sm font-extrabold text-forest-950">{r.name}</span>
                      {r.kind === "chemical" ? (
                        <div className="mt-2 rounded-lg bg-forest-50/60 p-2 text-xs text-forest-900">
                          <span className="font-bold text-forest-950">Requirement: </span>
                          {String((r as { criterion?: string; requirementText?: string }).requirementText || (r as { criterion?: string }).criterion || "Standard RSL Requirement")}
                        </div>
                      ) : (
                        <span className="block text-lg font-black text-forest-800">
                          {String((r as { breakdown?: string }).breakdown ?? "")}
                        </span>
                      )}
                    </summary>
                    <div className="px-4 pb-4 text-xs leading-relaxed text-forest-900/75">
                      {r.kind === "chemical" ? (
                        <div className="space-y-1">
                          <p>
                            <strong className="text-forest-950">Compliance Status:</strong>{" "}
                            <span className={`font-bold ${r.status === "PASS" ? "text-emerald-700" : r.status === "FAIL" ? "text-red-700" : "text-stone-600"}`}>
                              {String(r.status)}
                            </span>
                          </p>
                          <p>
                            <strong className="text-forest-950">Standard:</strong>{" "}
                            {String((r as { criterion?: string; requirementText?: string }).requirementText || (r as { criterion?: string }).criterion || "")}
                          </p>
                        </div>
                      ) : (
                        <>
                          {"cas" in r && <p>CAS: {String(r.cas)}</p>}
                          {"component" in r && r.component ? <p>Component: {String(r.component)}</p> : null}
                          <p>Criterion: {String((r as { criterion?: string }).criterion ?? "")}</p>
                          {"testDate" in r && r.testDate ? <p>Date: {String(r.testDate)}</p> : null}
                          {"reportRef" in r && r.reportRef ? <p>Report: {String(r.reportRef)} ({String((r as { labLine?: string }).labLine ?? "")})</p> : null}
                        </>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          </div>
        )}

        {s.packaging && (
          <div id="s-packaging">
            <Section id="s-packaging-sec" title="Packaging & Disposal" summary={s.packaging.type}>
              <dl className="space-y-1 text-sm">
                <div><dt className="label !mb-0">Type</dt><dd>{s.packaging.type}</dd></div>
                <div><dt className="label !mb-0">Materials</dt><dd>{s.packaging.materials.join(", ")}</dd></div>
                <div><dt className="label !mb-0">Recycled content</dt><dd>{s.packaging.recycledContent}</dd></div>
                <div><dt className="label !mb-0">Recyclability</dt><dd>{s.packaging.recyclability}</dd></div>
                <div><dt className="label !mb-0">Disposal guidance</dt><dd className="whitespace-pre-wrap">{s.packaging.instructions}</dd></div>
              </dl>
            </Section>
          </div>
        )}

        {s.environmental && (
          <div id="s-environment">
            <Section id="s-environment-sec" title="Environmental Impact"
              summary={`${s.environmental.carbonKgCo2e} kg CO₂e / garment`}>
              <div className="rounded-2xl bg-forest-950 p-5 text-center text-white">
                <p className="text-3xl font-black">{s.environmental.carbonKgCo2e}</p>
                <p className="text-xs text-white/70">kg CO₂e / garment · {s.environmental.totalEnergyKwh} kWh total</p>
              </div>
              <p className="mt-2 text-sm text-forest-900/70">
                Energy mix: grid {s.environmental.gridEnergyKwh} kWh ({s.environmental.gridSharePct}%) ·
                solar {s.environmental.solarEnergyKwh} kWh ({s.environmental.solarSharePct}%).
              </p>
              <details className="mt-2 rounded-xl bg-forest-50/60 px-4 py-3 ring-1 ring-forest-100">
                <summary className="cursor-pointer text-sm font-bold text-forest-800">How was it calculated?</summary>
                <p className="mt-1 text-xs leading-relaxed text-forest-900/70">{s.environmental.breakdown}</p>
              </details>
            </Section>
          </div>
        )}

        {s.certification.length > 0 && (
          <div id="s-certification">
            <Section id="s-certification-sec" title="Certification & Compliance"
              summary={`${s.certification.length} record(s)`}>
              <div className="space-y-2">
                {s.certification.map((c, i) => (
                  <details key={i} className="rounded-xl bg-white px-4 py-3 ring-1 ring-forest-100">
                    <summary className="cursor-pointer list-none text-sm font-extrabold text-forest-950 [&::-webkit-details-marker]:hidden">
                      {c.name} · {c.recordType} <span className={`badge ml-1 ${statusTone(c.status)}`}>{c.status}</span>
                    </summary>
                    <div className="mt-1 text-xs leading-relaxed text-forest-900/75">
                      <p><strong>Scope:</strong> {c.scope}</p>
                      {c.facility && <p>Facility: {c.facility}{c.tier ? ` · ${c.tier}` : ""}</p>}
                      {c.requirement && <p>Requirement: {c.requirement}</p>}
                      <p>
                        {[c.issueDate && `Issued ${c.issueDate}`, c.expiryDate && `expires ${c.expiryDate}`, c.assessmentDate && `assessed ${c.assessmentDate}`].filter(Boolean).join(" · ")}
                      </p>
                      {c.evidenceUrl && <p><a href={c.evidenceUrl} className="font-bold text-forest-700 underline">Approved evidence →</a></p>}
                      <p className="mt-1 text-forest-900/55">A facility certificate covers its stated scope — not every garment made there. No logos are shown.</p>
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          </div>
        )}
      </main>

      <footer className="border-t border-forest-100 bg-white/70 px-4 pb-8 pt-6 text-center">
        <p className="text-[11px] font-black tracking-widest text-forest-500">DIGITAL PRODUCT PASSPORT</p>
        <p className="mt-1 text-xs text-forest-900/60">
          Version {doc.version}
          {publishedOn ? ` · Published ${publishedOn}` : ""} · Scan the QR to verify this page is the passport of record.
        </p>
      </footer>
    </div>
  );
}
