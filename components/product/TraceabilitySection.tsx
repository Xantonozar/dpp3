"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiErrorMessage } from "@/lib/apiError";

const FIELD_LABELS: Record<string, string> = {
  originDestination: "Origin & destination",
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3 yarn",
  dataSource: "Data source",
};

type Group = { name: string; location: string; processes: string[]; processStatus: string };
type Yarn = { name: string; location: string; country: string; yarnType: string; yarnCount: string; composition: string; referenceLot: string };
type Origin = { countryOfManufacture: string; finalFactory: string; finalFactoryLocation: string; destinationCountry: string; destinationMarket: string; buyerBrand: string };

const T1 = [
  ["cutting", "Cutting"],
  ["sewing", "Sewing"],
  ["garment_finishing", "Garment Finishing"],
];
const T2 = [
  ["knitting", "Knitting"],
  ["dyeing", "Dyeing"],
  ["printing", "Printing"],
  ["fabric_finishing", "Fabric Finishing"],
];
const ARRANGEMENTS = [
  ["same", "All processes at the same factory"],
  ["different", "Processes at different factories"],
  ["mixed", "Some processes at the same factory, others at different factories"],
];

export const TIER3_COUNTRIES = [
  "Bangladesh",
  "India",
  "China",
  "Pakistan",
  "Turkey",
  "South Africa",
  "Egypt",
] as const;

export const YARN_TYPES = [
  "Ring spun",
  "Open End/Rotor Spun",
  "Compact spun",
  "Air-Jet Spun",
  "Other",
  "Unknown",
] as const;

const blankGroup = (): Group => ({ name: "", location: "", processes: [], processStatus: "Assigned" });
const blankYarn = (): Yarn => ({ name: "", location: "", country: "", yarnType: "", yarnCount: "", composition: "", referenceLot: "" });
const blankOrigin = (): Origin => ({ countryOfManufacture: "", finalFactory: "", finalFactoryLocation: "", destinationCountry: "", destinationMarket: "", buyerBrand: "" });

function GroupCard({
  index,
  group,
  processes,
  onChange,
  onRemove,
}: {
  index: number;
  group: Group;
  processes: string[][];
  onChange: (g: Group) => void;
  onRemove: () => void;
}) {
  return (
    <CollapsibleSection
      id={`facility-${index}`}
      level={3}
      title={group.name.trim() || `Facility ${index + 1}`}
      summary={`${group.processes.length} process(es)`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`fn-${index}`}>Factory name *</label>
          <input id={`fn-${index}`} className="input" value={group.name}
            onChange={(e) => onChange({ ...group, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor={`fl-${index}`}>Location *</label>
          <input id={`fl-${index}`} className="input" value={group.location}
            onChange={(e) => onChange({ ...group, location: e.target.value })} />
        </div>
      </div>
      <fieldset className="mt-3">
        <legend className="label">Processes at this facility</legend>
        <div className="flex flex-wrap gap-2">
          {processes.map(([key, label]) => {
            const on = group.processes.includes(key);
            return (
              <label key={key}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-bold ring-1 transition ${on ? "bg-forest-700 text-white ring-forest-700" : "bg-white text-forest-800 ring-forest-200 hover:bg-forest-50"}`}>
                <input type="checkbox" className="sr-only" checked={on}
                  onChange={() =>
                    onChange({ ...group, processes: on ? group.processes.filter((p) => p !== key) : [...group.processes, key] })
                  } />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <label className="label" htmlFor={`fs-${index}`}>Process status</label>
          <select id={`fs-${index}`} className="input !w-52" value={group.processStatus}
            onChange={(e) => onChange({ ...group, processStatus: e.target.value })}>
            <option>Assigned</option>
            <option>Unknown</option>
            <option>Not disclosed</option>
          </select>
        </div>
        <button onClick={onRemove} className="btn-secondary !py-2 text-xs !text-red-700">
          Remove
        </button>
      </div>
    </CollapsibleSection>
  );
}

export function TraceabilitySection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [countries, setCountries] = useState<{ code: string; label: string }[]>([]);
  const [origin, setOrigin] = useState<Origin>(blankOrigin());
  const [t1arr, setT1arr] = useState("");
  const [t1, setT1] = useState<Group[]>([blankGroup()]);
  const [t2arr, setT2arr] = useState("");
  const [printing, setPrinting] = useState("");
  const [t2, setT2] = useState<Group[]>([blankGroup()]);
  const [yarns, setYarns] = useState<Yarn[]>([blankYarn()]);
  const [dataSource, setDataSource] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [warns, setWarns] = useState<string[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [co, tr, prod] = await Promise.all([
      fetch("/api/catalogs/country").then((r) => r.json()),
      fetch(`/api/products/${pid}/traceability`).then((r) => r.json()),
      fetch(`/api/products/${pid}`).then((r) => r.json()),
    ]);
    setCountries((co.data ?? []).map((o: { code: string; label: string }) => ({ code: o.code, label: o.label })));
    const d = tr.data;
    setOrigin({ ...blankOrigin(), ...(d?.originDestination ?? {}), buyerBrand: d?.originDestination?.buyerBrand ?? prod.data?.buyerBrand ?? "" });
    setT1arr(d?.tier1?.arrangement ?? "");
    setT1(d?.tier1?.facilities?.length ? d.tier1.facilities : [blankGroup()]);
    setT2arr(d?.tier2?.arrangement ?? "");
    setPrinting(d?.tier2?.printingStatus ?? "");
    setT2(d?.tier2?.facilities?.length ? d.tier2.facilities : [blankGroup()]);
    setYarns(d?.tier3?.yarnManufacturers?.length ? d.tier3.yarnManufacturers.map((y: Yarn) => ({ ...blankYarn(), ...y })) : [blankYarn()]);
    setDataSource(d?.dataSource ?? "");
    setDirty(false);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (id) load(id).catch((e) => {
      setErr(e instanceof Error ? e.message : "Load failed");
      setBusy(false);
    });
  }, [id, load]);

  function touch() {
    setDirty(true);
    setMsg("");
  }

  function changeArrangement(which: "t1" | "t2", next: string) {
    const groups = which === "t1" ? t1 : t2;
    const hasData = groups.some((g) => g.name.trim() || g.location.trim() || g.processes.length > 0);
    if (hasData && !window.confirm("Switch arrangement? Your facility entries are kept; process assignments will be re-checked on save.")) return;
    if (which === "t1") setT1arr(next);
    else setT2arr(next);
    touch();
  }

  function changePrinting(next: string) {
    if (next === "Not performed") {
      const claimed = t2.filter((g) => g.processes.includes("printing")).length;
      if (claimed > 0 && !window.confirm(`Printing is claimed by ${claimed} facilit${claimed > 1 ? "ies" : "y"}. Mark “Not performed” and remove Printing from them?`)) return;
      setT2(t2.map((g) => ({ ...g, processes: g.processes.filter((p) => p !== "printing") })));
    }
    setPrinting(next);
    touch();
  }

  function removeGroup(which: "t1" | "t2", i: number) {
    const groups = which === "t1" ? t1 : t2;
    const g = groups[i];
    if (!window.confirm(`Remove facility “${g.name.trim() || `#${i + 1}`}”? Its processes become unassigned.`)) return;
    const next = groups.filter((_, k) => k !== i);
    if (which === "t1") setT1(next.length ? next : [blankGroup()]);
    else setT2(next.length ? next : [blankGroup()]);
    touch();
  }

  function removeYarn(i: number) {
    if (yarns.length === 1) {
      setErr("At least one yarn manufacturer is required — the only card cannot be removed.");
      return;
    }
    if (!window.confirm("Remove this yarn manufacturer?")) return;
    setYarns(yarns.filter((_, k) => k !== i));
    touch();
  }

  const summaryRows = useMemo(() => {
    const rows: { tier: string; process: string; factory: string; location: string; note: string }[] = [];
    const find = (groups: Group[], p: string) => groups.find((g) => g.processes.includes(p));
    for (const [key, label] of T1) {
      const g = find(t1, key);
      rows.push({
        tier: "Tier 1", process: label,
        factory: g?.name.trim() || "—", location: g?.location.trim() || "—",
        note: !g ? "Unassigned" : g.processStatus !== "Assigned" ? g.processStatus : "",
      });
    }
    for (const [key, label] of T2) {
      if (key === "printing" && printing === "Not performed") {
        rows.push({ tier: "Tier 2", process: label, factory: "—", location: "—", note: "Not performed" });
        continue;
      }
      const g = find(t2, key);
      rows.push({
        tier: "Tier 2", process: label,
        factory: g?.name.trim() || "—", location: g?.location.trim() || "—",
        note: !g ? (key === "printing" && printing === "Unknown" ? "Unknown" : "Unassigned") : g.processStatus !== "Assigned" ? g.processStatus : "",
      });
    }
    return rows;
  }, [t1, t2, printing]);

  async function save(mode: "draft" | "final") {
    setSaving(true);
    setMsg("");
    setWarns([]);
    setErr("");
    try {
      const res = await fetch(`/api/products/${id}/traceability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          originDestination: origin,
          tier1: { arrangement: t1arr || undefined, facilities: t1 },
          tier2: { arrangement: t2arr || undefined, printingStatus: printing || undefined, facilities: t2 },
          tier3: { yarnManufacturers: yarns },
          dataSource: dataSource.trim() || undefined,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(out, FIELD_LABELS));
      setWarns(out.warnings ?? []);
      setMsg(mode === "final" ? "Reviewed & saved." : "Draft saved.");
      setDirty(false);
      await load(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading traceability…</div>;

  return (
    <div className="space-y-4">
      {dirty && <p className="text-xs font-semibold text-amber-700">● Unsaved changes</p>}
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {warns.map((w, i) => (
        <p key={i} className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">⚠ {w}</p>
      ))}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <CollapsibleSection id="traceability" level={1} help={() => startTour("traceability", "traceability")} title="3. Traceability"
        summary={`${t1.filter((g) => g.name.trim()).length + t2.filter((g) => g.name.trim()).length} facilities · ${yarns.filter((y) => y.name.trim()).length} yarn makers`}
        defaultOpen>
        <div className="space-y-3">
          <CollapsibleSection id="trc-origin" level={2} help={() => startTour("traceability", "trc-origin")} title="A. Origin & Destination" defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="o-com">Country of manufacture *</label>
                <select id="o-com" className="input" value={origin.countryOfManufacture}
                  onChange={(e) => { setOrigin({ ...origin, countryOfManufacture: e.target.value }); touch(); }}>
                  <option value="">Select…</option>
                  {countries.map((c) => <option key={c.code} value={c.label}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="o-dest">Destination country *</label>
                <select id="o-dest" className="input" value={origin.destinationCountry}
                  onChange={(e) => { setOrigin({ ...origin, destinationCountry: e.target.value }); touch(); }}>
                  <option value="">Select…</option>
                  <option value="Not specified">Not specified</option>
                  {countries.map((c) => <option key={c.code} value={c.label}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="o-ff">Final factory *</label>
                <input id="o-ff" className="input" value={origin.finalFactory}
                  onChange={(e) => { setOrigin({ ...origin, finalFactory: e.target.value }); touch(); }} />
              </div>
              <div>
                <label className="label" htmlFor="o-ffl">Final factory location *</label>
                <input id="o-ffl" className="input" value={origin.finalFactoryLocation}
                  onChange={(e) => { setOrigin({ ...origin, finalFactoryLocation: e.target.value }); touch(); }} />
              </div>
              <div>
                <label className="label" htmlFor="o-market">Destination market</label>
                <input id="o-market" className="input" value={origin.destinationMarket}
                  onChange={(e) => { setOrigin({ ...origin, destinationMarket: e.target.value }); touch(); }} />
              </div>
              <div>
                <label className="label" htmlFor="o-buyer">Buyer / brand</label>
                <input id="o-buyer" className="input" value={origin.buyerBrand}
                  onChange={(e) => { setOrigin({ ...origin, buyerBrand: e.target.value }); touch(); }} />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="trc-tier1" level={2} help={() => startTour("traceability", "trc-tier1")} title="B. Tier 1 Garment Manufacturing"
            summary={`${t1.filter((g) => g.name.trim()).length} facilit${t1.filter((g) => g.name.trim()).length === 1 ? "y" : "ies"}`} defaultOpen>
            <fieldset>
              <legend className="label">How are Tier 1 processes performed?</legend>
              <div className="flex flex-col gap-1.5">
                {ARRANGEMENTS.map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-forest-100 hover:bg-forest-50">
                    <input type="radio" name="t1arr" checked={t1arr === v} onChange={() => changeArrangement("t1", v)} className="accent-green-700" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-3 space-y-3">
              {t1.map((g, i) => (
                <GroupCard key={i} index={i} group={g} processes={T1}
                  onChange={(ng) => { const n = [...t1]; n[i] = ng; setT1(n); touch(); }}
                  onRemove={() => removeGroup("t1", i)} />
              ))}
              <button onClick={() => { setT1([...t1, blankGroup()]); touch(); }} className="btn-secondary !py-2 text-xs">
                + Add Another Facility
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="trc-tier2" level={2} help={() => startTour("traceability", "trc-tier2")} title="C. Tier 2 Fabric Manufacturing"
            summary={`${t2.filter((g) => g.name.trim()).length} facilit${t2.filter((g) => g.name.trim()).length === 1 ? "y" : "ies"}`}>
            <fieldset>
              <legend className="label">How are Tier 2 processes performed?</legend>
              <div className="flex flex-col gap-1.5">
                {ARRANGEMENTS.map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-forest-100 hover:bg-forest-50">
                    <input type="radio" name="t2arr" checked={t2arr === v} onChange={() => changeArrangement("t2", v)} className="accent-green-700" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-3">
              <label className="label" htmlFor="printing">Printing status *</label>
              <select id="printing" className="input max-w-xs" value={printing} onChange={(e) => changePrinting(e.target.value)}>
                <option value="">Select…</option>
                <option>Performed</option>
                <option>Not performed</option>
                <option>Unknown</option>
              </select>
            </div>
            <div className="mt-3 space-y-3">
              {t2.map((g, i) => (
                <GroupCard key={i} index={100 + i} group={g}
                  processes={printing === "Not performed" ? T2.filter(([k]) => k !== "printing") : T2}
                  onChange={(ng) => { const n = [...t2]; n[i] = ng; setT2(n); touch(); }}
                  onRemove={() => removeGroup("t2", i)} />
              ))}
              <button onClick={() => { setT2([...t2, blankGroup()]); touch(); }} className="btn-secondary !py-2 text-xs">
                + Add Another Facility
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="trc-tier3" level={2} help={() => startTour("traceability", "trc-tier3")} title="D. Tier 3 Yarn Manufacturing"
            summary={`${yarns.filter((y) => y.name.trim()).length} yarn maker(s)`}>
            <div className="space-y-3">
              {yarns.map((y, i) => (
                <CollapsibleSection key={i} id={`yarn-${i}`} level={3}
                  title={y.name.trim() || `Yarn manufacturer ${i + 1}`}
                  summary={[y.country, y.yarnType].filter(Boolean).join(" · ")}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor={`yn-${i}`}>Manufacturer name *</label>
                      <input id={`yn-${i}`} className="input" placeholder="e.g. Dhaka Spinning Mills" value={y.name}
                        onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], name: e.target.value }; setYarns(n); touch(); }} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`yl-${i}`}>Location *</label>
                      <input id={`yl-${i}`} className="input" placeholder="e.g. Narayanganj" value={y.location}
                        onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], location: e.target.value }; setYarns(n); touch(); }} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor={`yc-${i}`}>Country of origin *</label>
                      <select id={`yc-${i}`} className="input" value={y.country}
                        onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], country: e.target.value }; setYarns(n); touch(); }}>
                        <option value="">Select country of origin…</option>
                        {TIER3_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        {y.country && !(TIER3_COUNTRIES as readonly string[]).includes(y.country) && (
                          <option value={y.country}>{y.country}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Yarn Details */}
                  <div className="mt-4 rounded-xl border border-forest-100 bg-forest-50/50 p-4">
                    <p className="mb-3 text-xs font-black uppercase tracking-wider text-forest-900">
                      🧵 Yarn Details
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor={`yt-${i}`}>Yarn Type</label>
                        <select id={`yt-${i}`} className="input" value={y.yarnType}
                          onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], yarnType: e.target.value }; setYarns(n); touch(); }}>
                          <option value="">Select yarn type…</option>
                          {YARN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          {y.yarnType && !(YARN_TYPES as readonly string[]).includes(y.yarnType) && (
                            <option value={y.yarnType}>{y.yarnType}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor={`yk-${i}`}>Yarn Count (optional)</label>
                        <input id={`yk-${i}`} className="input" placeholder="e.g. Ne 30/1" value={y.yarnCount}
                          onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], yarnCount: e.target.value }; setYarns(n); touch(); }} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor={`ym-${i}`}>Yarn Composition</label>
                        <input id={`ym-${i}`} className="input" placeholder="e.g. 100% Cotton" value={y.composition}
                          onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], composition: e.target.value }; setYarns(n); touch(); }} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor={`yr-${i}`}>Reference lot (optional)</label>
                        <input id={`yr-${i}`} className="input" placeholder="e.g. Lot #123" value={y.referenceLot}
                          onChange={(e) => { const n = [...yarns]; n[i] = { ...n[i], referenceLot: e.target.value }; setYarns(n); touch(); }} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeYarn(i)} className="btn-secondary mt-3 !py-2 text-xs !text-red-700">
                    Remove
                  </button>
                </CollapsibleSection>
              ))}
              <button onClick={() => { setYarns([...yarns, blankYarn()]); touch(); }} className="btn-secondary !py-2 text-xs">
                + Add Another Yarn Manufacturer
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="trc-summary" level={2} help={() => startTour("traceability", "trc-summary")} title="E. Review Manufacturing Summary"
            summary={`${summaryRows.filter((r) => r.factory !== "—").length} of ${summaryRows.length} mapped`}>
            <div className="overflow-x-auto rounded-xl ring-1 ring-forest-100">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="bg-forest-50 text-xs uppercase tracking-wide text-forest-800">
                    <th className="px-4 py-2.5">Process</th>
                    <th className="px-4 py-2.5">Factory</th>
                    <th className="px-4 py-2.5">Location</th>
                    <th className="px-4 py-2.5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-50 bg-white">
                  {summaryRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-semibold text-forest-950">{r.tier} · {r.process}</td>
                      <td className="px-4 py-2.5">{r.factory}</td>
                      <td className="px-4 py-2.5">{r.location}</td>
                      <td className="px-4 py-2.5">
                        {r.note && <StatusBadge tone={r.note === "Unassigned" ? "error" : "warn"}>{r.note}</StatusBadge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          <div>
            <label className="label" htmlFor="ds">Data source</label>
            <input id="ds" className="input" placeholder="e.g. Factory BOM / supplier declaration"
              value={dataSource} onChange={(e) => { setDataSource(e.target.value); touch(); }} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-forest-100 pt-3">
            {msg && <p className="mr-auto text-sm font-semibold text-forest-800">{msg}</p>}
            {err && <p role="alert" className="mr-auto text-sm font-semibold text-red-700">{err}</p>}
            <button onClick={() => save("draft")} disabled={saving} className="btn-secondary !py-2 text-xs">
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button onClick={() => save("final")} disabled={saving} className="btn-primary !py-2 text-xs">
              Review &amp; Save
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
