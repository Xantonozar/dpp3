"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { apiErrorMessage } from "@/lib/apiError";

const FIELD_LABELS: Record<string, string> = {
  packagingType: "Packaging type",
  packagingMaterials: "Packaging materials",
  recycledContentStatus: "Recycled content",
  recycledContentPercent: "Recycled content %",
  recyclability: "Recyclability",
  disposalReuseInstructions: "Disposal instructions",
  dataSource: "Data source",
};

type Opt = { code: string; label: string };

const RECYCLABILITY = ["Recyclable", "Non-recyclable", "Conditionally Recyclable", "Reusable", "Not Available"];
const PLACEHOLDERS = ["5.2 Care", "5.3 Stain", "5.4 Repair", "5.5 Upcycling"];

export function PackagingSection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [types, setTypes] = useState<Opt[]>([]);
  const [materials, setMaterials] = useState<Opt[]>([]);
  const [type, setType] = useState({ code: "", other: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [otherMat, setOtherMat] = useState("");
  const [rcStatus, setRcStatus] = useState<"Provided" | "Not Available">("Not Available");
  const [rcPercent, setRcPercent] = useState("");
  const [recyclability, setRecyclability] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [t, m, pkg] = await Promise.all([
      fetch("/api/catalogs/packaging_type").then((r) => r.json()),
      fetch("/api/catalogs/packaging_material").then((r) => r.json()),
      fetch(`/api/products/${pid}/packaging`).then((r) => r.json()),
    ]);
    setTypes((t.data ?? []).filter((o: Opt & { active?: boolean }) => o.active !== false));
    setMaterials((m.data ?? []).filter((o: Opt & { active?: boolean }) => o.active !== false));
    const d = pkg.data;
    setType({ code: d?.packagingType?.code ?? "", other: d?.packagingType?.other ?? "" });
    setPicked((d?.packagingMaterials ?? []).map((x: { code: string }) => x.code));
    setOtherMat((d?.packagingMaterials ?? []).find((x: { code: string }) => x.code === "other")?.other ?? "");
    setRcStatus(d?.recycledContentStatus ?? "Not Available");
    setRcPercent(d?.recycledContentPercent != null ? String(d.recycledContentPercent) : "");
    setRecyclability(d?.recyclability ?? "");
    setInstructions(d?.disposalReuseInstructions ?? "");
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

  const typeLabel = useMemo(
    () => (type.code === "other" ? otherLabel() : types.find((o) => o.code === type.code)?.label ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, types]
  );
  function otherLabel() {
    return type.other.trim() || "Other";
  }

  function toggleMaterial(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
    touch();
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/products/${id}/packaging`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagingType: { code: type.code, other: type.other.trim() || undefined },
          packagingMaterials: picked.map((code) => ({
            code,
            other: code === "other" ? otherMat.trim() || undefined : undefined,
          })),
          recycledContentStatus: rcStatus,
          recycledContentPercent: rcStatus === "Provided" && rcPercent.trim() !== "" ? Number(rcPercent) : null,
          recyclability: recyclability || undefined,
          disposalReuseInstructions: instructions,
          dataSource: dataSource.trim() || undefined,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(out, FIELD_LABELS));
      setMsg("Saved.");
      setDirty(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading packaging…</div>;

  return (
    <div className="space-y-4">
      {dirty && <p className="text-xs font-semibold text-amber-700">● Unsaved changes</p>}
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <CollapsibleSection id="care" level={1} help={() => startTour("packaging", "care")} title="5. Care & Circularity"
        summary={typeLabel && recyclability ? `${typeLabel} · ${recyclability}` : "Packaging & disposal"} defaultOpen>
        <div className="space-y-3">
          {PLACEHOLDERS.map((t) => (
            <div key={t} className="rounded-xl bg-forest-50/60 px-4 py-3 text-sm text-forest-900/60 ring-1 ring-forest-100">
              <strong className="text-forest-900">{t}</strong> — Not yet specified.
            </div>
          ))}

          <CollapsibleSection id="pkg-51" level={2} help={() => startTour("packaging", "pkg-51")} title="5.1 Packaging & Disposal"
            summary={typeLabel && recyclability ? `${typeLabel} · ${recyclability}` : "Not filled yet"} defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ptype">Packaging type *</label>
                <select id="ptype" className="input" value={type.code}
                  onChange={(e) => { setType({ ...type, code: e.target.value }); touch(); }}>
                  <option value="">Select…</option>
                  {types.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
              </div>
              {type.code === "other" && (
                <div>
                  <label className="label" htmlFor="ptype-other">Specify type *</label>
                  <input id="ptype-other" className="input" value={type.other}
                    onChange={(e) => { setType({ ...type, other: e.target.value }); touch(); }} />
                </div>
              )}
            </div>

            <fieldset className="mt-4">
              <legend className="label">Packaging materials *</legend>
              <div className="flex flex-wrap gap-2">
                {materials.map((o) => {
                  const on = picked.includes(o.code);
                  return (
                    <label key={o.code}
                      className={`cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-bold ring-1 transition ${on ? "bg-forest-700 text-white ring-forest-700" : "bg-white text-forest-800 ring-forest-200 hover:bg-forest-50"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleMaterial(o.code)} />
                      {o.label}
                    </label>
                  );
                })}
              </div>
              {picked.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected materials">
                  {picked.map((c) => (
                    <span key={c} className="badge bg-forest-100 text-forest-800">
                      {c === "other" ? otherMat.trim() || "Other" : materials.find((o) => o.code === c)?.label ?? c}
                      <button onClick={() => toggleMaterial(c)} aria-label={`Remove ${c}`}
                        className="ml-1 font-black hover:text-red-700">✕</button>
                    </span>
                  ))}
                </div>
              )}
              {picked.includes("other") && (
                <div className="mt-2 max-w-sm">
                  <label className="label" htmlFor="omat">Specify material *</label>
                  <input id="omat" className="input" value={otherMat}
                    onChange={(e) => { setOtherMat(e.target.value); touch(); }} />
                </div>
              )}
            </fieldset>

            <fieldset className="mt-4">
              <legend className="label">Recycled content</legend>
              <p className="mb-2 text-xs text-forest-900/60">Overall declared value for the packaging (not per material).</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-forest-100">
                  <input type="radio" checked={rcStatus === "Provided"} onChange={() => { setRcStatus("Provided"); touch(); }} className="accent-green-700" />
                  Provided
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-forest-100">
                  <input type="radio" checked={rcStatus === "Not Available"} onChange={() => { setRcStatus("Not Available"); touch(); }} className="accent-green-700" />
                  Not Available
                </label>
                {rcStatus === "Provided" && (
                  <input className="input !w-32" inputMode="decimal" placeholder="0–100 %"
                    value={rcPercent} aria-label="Recycled content percent"
                    onChange={(e) => { setRcPercent(e.target.value); touch(); }} />
                )}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="rec">Recyclability *</label>
                <select id="rec" className="input" value={recyclability}
                  onChange={(e) => { setRecyclability(e.target.value); touch(); }}>
                  <option value="">Select…</option>
                  {RECYCLABILITY.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ds">Data source</label>
                <input id="ds" className="input" value={dataSource}
                  onChange={(e) => { setDataSource(e.target.value); touch(); }} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="instr">Disposal / reuse instructions *</label>
              <textarea id="instr" className="input min-h-24 whitespace-pre-wrap" rows={4}
                value={instructions} onChange={(e) => { setInstructions(e.target.value); touch(); }}
                placeholder={"Rinse the polybag.\nReuse for storage or recycle with soft plastics."} />
            </div>
          </CollapsibleSection>
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
