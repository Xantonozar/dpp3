"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { calcComposition, canonicalFiber } from "@/lib/calc/composition";
import { apiErrorMessage } from "@/lib/apiError";
import { HelpLink } from "@/components/ui/HelpLink";

const FIELD_LABELS: Record<string, string> = {
  fabricType: "Fabric type",
  fibers: "Fiber rows",
  gsm: "GSM",
  construction: "Construction",
  trims: "Trims",
  dataSource: "Data source",
};

type Opt = { code: string; label: string; aliasOf?: string };
type FiberRow = { fiberCode: string; otherName: string; percentage: string };
type TrimRow = { componentCode: string; otherName: string; materialType: string };

async function getList(list: string): Promise<Opt[]> {
  const res = await fetch(`/api/catalogs/${list}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Failed to load ${list}`);
  return (body.data ?? []).filter((o: Opt & { active?: boolean }) => o.active !== false);
}

export function MaterialsSection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [fabricTypes, setFabricTypes] = useState<Opt[]>([]);
  const [fiberOpts, setFiberOpts] = useState<Opt[]>([]);
  const [trimOpts, setTrimOpts] = useState<Opt[]>([]);
  const [fabricType, setFabricType] = useState({ code: "", other: "" });
  const [fibers, setFibers] = useState<FiberRow[]>([]);
  const [gsm, setGsm] = useState("");
  const [construction, setConstruction] = useState("");
  const [trims, setTrims] = useState<TrimRow[]>([]);
  const [pendingTrim, setPendingTrim] = useState({ componentCode: "", otherName: "", materialType: "" });
  const [dataSource, setDataSource] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const aliases = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of fiberOpts) m[o.code.toLowerCase()] = (o.aliasOf ?? o.code).toLowerCase();
    m.spandex ??= "elastane";
    m.elastane ??= "elastane";
    return m;
  }, [fiberOpts]);

  const fiberLabel = useCallback(
    (code: string, other?: string) => {
      if (code === "other") return other?.trim() || "Other";
      return fiberOpts.find((o) => o.code === code)?.label ?? code;
    },
    [fiberOpts]
  );

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [ft, fb, tr, mat] = await Promise.all([
      getList("fabric_type"),
      getList("fiber_type"),
      getList("trim_component"),
      fetch(`/api/products/${pid}/materials`).then((r) => r.json()),
    ]);
    setFabricTypes(ft);
    setFiberOpts(fb);
    setTrimOpts(tr);
    const d = mat.data;
    setFabricType({ code: d?.mainFabric?.fabricType?.code ?? "", other: d?.mainFabric?.fabricType?.other ?? "" });
    setFibers(
      (d?.mainFabric?.fibers ?? []).map((f: { fiberCode: string; otherName?: string; percentage: number }) => ({
        fiberCode: f.fiberCode,
        otherName: f.otherName ?? "",
        percentage: String(f.percentage),
      }))
    );
    setGsm(d?.mainFabric?.gsm != null ? String(d.mainFabric.gsm) : "");
    setConstruction(d?.mainFabric?.construction ?? "");
    setTrims(
      (d?.trims ?? []).map((t: TrimRow) => ({
        componentCode: t.componentCode,
        otherName: t.otherName ?? "",
        materialType: t.materialType ?? "",
      }))
    );
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

  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);

  const pcts = useMemo(() => fibers.map((f) => Number(f.percentage) || 0), [fibers]);
  const { total, valid } = useMemo(() => calcComposition(pcts), [pcts]);

  const dupCanon = useMemo(() => {
    const seen = new Set<string>();
    for (const f of fibers) {
      if (!f.fiberCode) continue;
      const c = canonicalFiber(f.fiberCode, aliases);
      if (seen.has(c)) return f.fiberCode;
      seen.add(c);
    }
    return "";
  }, [fibers, aliases]);

  const summary = useMemo(() => {
    if (fibers.length === 0) return "No fibers yet";
    const parts = fibers
      .filter((f) => f.fiberCode)
      .map((f) => `${fiberLabel(f.fiberCode, f.otherName)} ${f.percentage || "–"}%`);
    return parts.join(" + ") || "No fibers yet";
  }, [fibers, fiberLabel]);

  function touch() {
    setDirty(true);
    setMsg("");
  }

  function addFiber() {
    setFibers((f) => [...f, { fiberCode: "", otherName: "", percentage: "" }]);
    touch();
  }

  function addTrim() {
    setErr("");
    if (!pendingTrim.componentCode) {
      setErr("Select a component first.");
      return;
    }
    if (pendingTrim.componentCode === "other" && !pendingTrim.otherName.trim()) {
      setErr("Component name is required when component is Other.");
      return;
    }
    const k = (t: TrimRow) => `${t.componentCode}|||${t.materialType.trim().toLowerCase()}`;
    const next: TrimRow = {
      componentCode: pendingTrim.componentCode,
      otherName: pendingTrim.otherName.trim(),
      materialType: pendingTrim.materialType.trim(),
    };
    if (trims.some((t) => k(t) === k(next))) {
      setErr("That trim is already listed with the same material detail.");
      return;
    }
    setTrims((t) => [...t, next]);
    setPendingTrim({ componentCode: "", otherName: "", materialType: "" });
    touch();
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const gsmNum = gsm.trim() === "" ? undefined : Number(gsm);
      if (gsm.trim() !== "" && !(gsmNum! > 0)) throw new Error("GSM must be a positive number (g/m²), or blank.");
      const body = {
        fabricType: fabricType.code ? { code: fabricType.code, other: fabricType.other.trim() || undefined } : undefined,
        fibers: fibers.map((f) => ({
          fiberCode: f.fiberCode,
          otherName: f.otherName.trim() || undefined,
          percentage: Number(f.percentage),
        })),
        gsm: gsmNum ?? null,
        construction: construction.trim() || undefined,
        trims: trims.map((t) => ({
          componentCode: t.componentCode,
          otherName: t.otherName.trim() || undefined,
          materialType: t.materialType.trim() || undefined,
        })),
        dataSource: dataSource.trim() || undefined,
      };
      const res = await fetch(`/api/products/${id}/materials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(out, FIELD_LABELS));
      setMsg(`Saved — composition ${out.data.mainFabric.compositionTotal}%.`);
      setDirty(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading materials…</div>;

  return (
    <div className="space-y-4">
      {dirty && <p className="text-xs font-semibold text-amber-700">● Unsaved changes</p>}
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <CollapsibleSection id="materials" level={1} help={() => startTour("materials", "materials")} title="2. Materials & Composition"
        summary={gsm ? `${summary} | ${gsm} g/m²` : summary} defaultOpen
        hasError={(!valid && fibers.length > 0) || !!dupCanon}>
        <div className="space-y-3">
          <CollapsibleSection id="materials-fabric" level={2} help={() => startTour("materials", "materials-fabric")} title="2.1 Main Fabric Composition"
            summary={summary} defaultOpen hasError={!valid && fibers.length > 0}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ftype">Fabric type</label>
                <select id="ftype" className="input" value={fabricType.code}
                  onChange={(e) => { setFabricType({ ...fabricType, code: e.target.value }); touch(); }}>
                  <option value="">Select…</option>
                  {fabricTypes.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </div>
              {fabricType.code === "other" && (
                <div>
                  <label className="label" htmlFor="ftype-other">Specify fabric type *</label>
                  <input id="ftype-other" className="input" value={fabricType.other}
                    onChange={(e) => { setFabricType({ ...fabricType, other: e.target.value }); touch(); }} />
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {fibers.map((f, i) => (
                <div key={i} className="grid items-end gap-2 rounded-xl bg-forest-50/60 p-3 sm:grid-cols-[1fr_1fr_130px_auto]">
                  <div>
                    <label className="label" htmlFor={`ff-${i}`}>Fiber</label>
                    <select id={`ff-${i}`} className="input" value={f.fiberCode}
                      onChange={(e) => {
                        const next = [...fibers];
                        next[i] = { ...next[i], fiberCode: e.target.value };
                        setFibers(next);
                        touch();
                      }}>
                      <option value="">Select…</option>
                      {fiberOpts.map((o) => (
                        <option key={o.code} value={o.code}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {f.fiberCode === "other" ? (
                    <div>
                      <label className="label" htmlFor={`fo-${i}`}>Fiber name *</label>
                      <input id={`fo-${i}`} className="input" value={f.otherName}
                        onChange={(e) => {
                          const next = [...fibers];
                          next[i] = { ...next[i], otherName: e.target.value };
                          setFibers(next);
                          touch();
                        }} />
                    </div>
                  ) : <div />}
                  <div>
                    <label className="label" htmlFor={`fp-${i}`}>% *</label>
                    <input id={`fp-${i}`} className="input" inputMode="decimal" placeholder="e.g. 95"
                      value={f.percentage}
                      onChange={(e) => {
                        const next = [...fibers];
                        next[i] = { ...next[i], percentage: e.target.value };
                        setFibers(next);
                        touch();
                      }} />
                  </div>
                  <button className="btn-secondary !px-3 !py-2 text-xs !text-red-700"
                    onClick={() => { setFibers(fibers.filter((_, k) => k !== i)); touch(); }}>
                    Remove
                  </button>
                  {f.percentage !== "" && !(Number(f.percentage) > 0 && Number(f.percentage) <= 100) && (
                    <p className="text-xs font-semibold text-red-700 sm:col-span-4">Enter a value above 0 up to 100.</p>
                  )}
                </div>
              ))}
              {fibers.length === 0 && (
                <p className="text-sm text-forest-900/60">Add at least one fiber to describe the main fabric.</p>
              )}
              <button onClick={addFiber} className="btn-secondary !py-2 text-xs">+ Add Fiber</button>
            </div>

            <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-extrabold ring-1 ${valid ? "bg-forest-100 text-forest-800 ring-forest-200" : "bg-red-50 text-red-700 ring-red-200"}`}
              role="status">
              Total: {Number.isFinite(total) ? total : 0}% {valid ? "· Valid" : "· must total 100% to save"}{" "}
              <HelpLink anchor="help-workflow" label="Why materials must total 100%" />
            </div>
            {dupCanon && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Duplicate: {dupCanon} is already listed (elastane and spandex count as one).
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="gsm">GSM (g/m²)</label>
                <input id="gsm" className="input" inputMode="decimal" placeholder="e.g. 180"
                  value={gsm} onChange={(e) => { setGsm(e.target.value); touch(); }} />
              </div>
              <div>
                <label className="label" htmlFor="cons">Construction</label>
                <input id="cons" className="input" placeholder="e.g. Single jersey"
                  value={construction} onChange={(e) => { setConstruction(e.target.value); touch(); }} />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="materials-trims" level={2} help={() => startTour("materials", "materials-trims")} title="2.2 Trims & Accessories"
            summary={trims.length === 0 ? "No trims yet" : `${trims.length} item(s)`}>
            <div className="grid items-end gap-2 rounded-xl bg-forest-50/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <label className="label" htmlFor="tc">Select Component</label>
                <select id="tc" className="input" value={pendingTrim.componentCode}
                  onChange={(e) => setPendingTrim({ ...pendingTrim, componentCode: e.target.value })}>
                  <option value="">Select…</option>
                  {trimOpts.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </div>
              {pendingTrim.componentCode === "other" ? (
                <div>
                  <label className="label" htmlFor="tco">Specify *</label>
                  <input id="tco" className="input" value={pendingTrim.otherName}
                    onChange={(e) => setPendingTrim({ ...pendingTrim, otherName: e.target.value })} />
                </div>
              ) : <div />}
              <div>
                <label className="label" htmlFor="tm">Material Type</label>
                <input id="tm" className="input" placeholder="e.g. Polyester"
                  value={pendingTrim.materialType}
                  onChange={(e) => setPendingTrim({ ...pendingTrim, materialType: e.target.value })} />
              </div>
              <button onClick={addTrim} className="btn-primary !py-2.5 text-xs">Add Component</button>
            </div>
            <div className="mt-3">
              <p className="label">Selected Components</p>
              {trims.length === 0 ? (
                <p className="text-sm text-forest-900/60">No trims or accessories yet — add one below.</p>
              ) : (
                <ul className="space-y-1.5">
                  {trims.map((t, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2 text-sm ring-1 ring-forest-100">
                      <span>
                        <strong className="text-forest-950">
                          {t.componentCode === "other" ? t.otherName : (trimOpts.find((o) => o.code === t.componentCode)?.label ?? t.componentCode)}
                        </strong>
                        {t.materialType && <span className="text-forest-900/60"> · {t.materialType}</span>}
                      </span>
                      <button className="text-xs font-bold text-red-700 hover:underline"
                        onClick={() => { setTrims(trims.filter((_, k) => k !== i)); touch(); }}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
            <button onClick={() => load(id)} className="btn-secondary !py-2 text-xs">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary !py-2 text-xs">
              {saving ? "Saving…" : "Save Section"}
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
