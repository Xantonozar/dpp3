"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { calcEnergy, type EnergyInputs } from "@/lib/calc/energy";
import { apiErrorMessage } from "@/lib/apiError";
import { FieldHint } from "@/components/ui/FieldHint";
import { HelpLink } from "@/components/ui/HelpLink";

const FIELD_LABELS: Record<string, string> = {
  garmentWeightKg: "Garment weight",
  cuttingUtilizationPct: "Cutting utilization",
  knittingKwhPerKg: "Knitting",
  dyeingKwhPerKg: "Dyeing",
  fabricFinishingKwhPerKg: "Fabric finishing",
  cuttingKwhPerGarment: "Cutting",
  sewingKwhPerGarment: "Sewing",
  garmentFinishingKwhPerGarment: "Garment finishing",
  gridSharePct: "Grid share",
  solarSharePct: "Solar share",
  dataSource: "Data source",
};

type Factor = { key: string; value: number; source: string; yearVersion: string };
type Saved = {
  inputs: Record<string, number>;
  emissionFactors: { gridKey: string; gridValue: number; solarKey: string; solarValue: number; source: string; yearVersion: string };
  results: {
    fabricRequiredKg: number;
    kwhPerGarment: Record<string, number>;
    totalEnergyKwh: number;
    gridEnergyKwh: number;
    solarEnergyKwh: number;
    carbonKgCo2e: number;
    calculatedAt: string;
  };
};

const FIELDS: { key: keyof EnergyInputs; label: string; unit: string }[] = [
  { key: "garmentWeightKg", label: "Garment weight", unit: "kg" },
  { key: "cuttingUtilizationPct", label: "Cutting utilization", unit: "%" },
  { key: "knittingKwhPerKg", label: "Knitting", unit: "kWh/kg" },
  { key: "dyeingKwhPerKg", label: "Dyeing", unit: "kWh/kg" },
  { key: "fabricFinishingKwhPerKg", label: "Fabric finishing", unit: "kWh/kg" },
  { key: "cuttingKwhPerGarment", label: "Cutting", unit: "kWh/garment" },
  { key: "sewingKwhPerGarment", label: "Sewing", unit: "kWh/garment" },
  { key: "garmentFinishingKwhPerGarment", label: "Garment finishing", unit: "kWh/garment" },
  { key: "gridSharePct", label: "Grid share", unit: "%" },
  { key: "solarSharePct", label: "Solar share", unit: "%" },
];

const blankInputs = (): Record<string, string> =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

export function EnvironmentalSection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [vals, setVals] = useState<Record<string, string>>(blankInputs());
  const [dataSource, setDataSource] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [factors, setFactors] = useState<{ grid: Factor; solar: Factor } | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [env] = await Promise.all([
      fetch(`/api/products/${pid}/environmental`).then((r) => r.json()),
    ]);
    setFactors(env.factors);
    const d = env.data;
    if (d?.inputs) {
      const next = blankInputs();
      for (const f of FIELDS) {
        if (d.inputs[f.key] != null) next[f.key] = String(d.inputs[f.key]);
      }
      setVals(next);
      setDataSource(d.dataSource ?? "");
      setSaved(d as Saved);
    }
    setDirty(false);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (id) load(id).catch((e) => {
      setErr(e instanceof Error ? e.message : "Load failed");
      setBusy(false);
    });
  }, [id, load]);

  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of FIELDS) {
      const v = vals[f.key].trim();
      out[f.key] = v === "" ? NaN : Number(v);
    }
    return out;
  }, [vals]);

  const preview = useMemo(() => {
    if (!factors) return null;
    if (FIELDS.some((f) => !Number.isFinite(parsed[f.key]))) return null;
    try {
      return calcEnergy(parsed as unknown as EnergyInputs, {
        grid: factors.grid.value,
        solar: factors.solar.value,
      });
    } catch {
      return null;
    }
  }, [parsed, factors]);

  const shown = preview ?? saved?.results ?? null;
  const shownFactors = factors ?? (saved
    ? {
        grid: { key: saved.emissionFactors.gridKey, value: saved.emissionFactors.gridValue, source: saved.emissionFactors.source, yearVersion: saved.emissionFactors.yearVersion },
        solar: { key: saved.emissionFactors.solarKey, value: saved.emissionFactors.solarValue, source: saved.emissionFactors.source, yearVersion: saved.emissionFactors.yearVersion },
      }
    : null);

  function touch() {
    setDirty(true);
    setMsg("");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const body: Record<string, number | string | undefined> = { dataSource: dataSource.trim() || undefined };
      for (const f of FIELDS) {
        const v = vals[f.key].trim();
        if (v === "") throw new Error(`${f.label} is required.`);
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`${f.label} must be a number.`);
        body[f.key] = n;
      }
      const res = await fetch(`/api/products/${id}/environmental`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(out, FIELD_LABELS));
      setMsg(`Saved — ${out.data.results.carbonKgCo2e} kg CO₂e / garment.`);
      setDirty(false);
      await load(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading environmental…</div>;

  return (
    <div className="space-y-4">
      {dirty && <p className="text-xs font-semibold text-amber-700">● Unsaved changes</p>}
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          {err}{" "}
          {err.includes("emission factor") && (
            <Link href="/admin/emission-factors" className="underline">Open emission factors →</Link>
          )}
        </p>
      )}

      <CollapsibleSection id="environmental" level={1} help={() => startTour("environment", "environmental")} title="6. Environmental Impact"
        summary={shown ? `${shown.carbonKgCo2e} kg CO₂e · ${shown.totalEnergyKwh} kWh` : "No calculation yet"} defaultOpen>
        <div className="space-y-3">
          <CollapsibleSection id="env-inputs" level={2} help={() => startTour("environment", "env-inputs")} title="6.1 Inputs" defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={`env-${f.key}`}>
                    {f.label} <span className="font-normal text-forest-900/50">({f.unit}) *</span>
                  </label>
                  <input id={`env-${f.key}`} className="input" inputMode="decimal"
                    value={vals[f.key]}
                    onChange={(e) => { setVals({ ...vals, [f.key]: e.target.value }); touch(); }} />
                </div>
              ))}
            </div>
            <FieldHint>
              Grid share + solar share must total exactly 100%. Carbon is calculated only after every
              emission factor carries a source and year — if saving refuses, add factors first.{" "}
              <HelpLink anchor="help-carbon" label="How carbon is calculated" />
            </FieldHint>
            <div className="mt-3">
              <label className="label" htmlFor="ds">Data source</label>
              <input id="ds" className="input" placeholder="e.g. Factory energy audit 2024"
                value={dataSource} onChange={(e) => { setDataSource(e.target.value); touch(); }} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="env-energy" level={2} help={() => startTour("environment", "env-energy")} title="6.2 Energy Results"
            summary={shown ? `${shown.totalEnergyKwh} kWh / garment` : "—"}>
            {!shown ? (
              <p className="text-sm text-forest-900/60">Enter inputs above to see results.</p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Fabric required", `${shown.fabricRequiredKg} kg`],
                  ["Total energy", `${shown.totalEnergyKwh} kWh`],
                  ["Grid energy", `${shown.gridEnergyKwh} kWh`],
                  ["Solar energy", `${shown.solarEnergyKwh} kWh`],
                  ["Knitting", `${shown.kwhPerGarment.knitting} kWh`],
                  ["Dyeing", `${shown.kwhPerGarment.dyeing} kWh`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-forest-50/70 px-4 py-3 ring-1 ring-forest-100">
                    <dt className="text-xs font-semibold text-forest-900/60">{k}</dt>
                    <dd className="text-lg font-black text-forest-900">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="env-carbon" level={2} help={() => startTour("environment", "env-carbon")} title="6.3 Carbon Footprint"
            summary={shown ? `${shown.carbonKgCo2e} kg CO₂e` : "—"}>
            {!factors && !saved ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                Add an emission factor with source and year in Admin &gt; Emission factors to calculate carbon.{" "}
                <HelpLink anchor="help-carbon" label="Emission factor requirements" />
              </p>
            ) : shown ? (
              <div className="card !bg-forest-950 p-6 text-center !text-white">
                <p className="text-4xl font-black tracking-tight">{shown.carbonKgCo2e}</p>
                <p className="mt-1 text-sm font-semibold text-white/70">kg CO₂e / garment</p>
                {shownFactors && (
                  <p className="mt-2 text-xs text-white/50">Grid {shownFactors.grid.value} · Solar {shownFactors.solar.value} kg CO₂e/kWh</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-forest-900/60">Enter valid inputs to calculate.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="env-how" level={2} help={() => startTour("environment", "env-how")} title="6.4 How was it calculated?">
            {!shown || !shownFactors ? (
              <p className="text-sm text-forest-900/60">The 7-step breakdown appears once inputs and emission factors exist.</p>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-forest-900/80">
                <li>Garment weight <strong>{vals.garmentWeightKg || saved?.inputs.garmentWeightKg} kg</strong> ÷ cutting utilization <strong>{vals.cuttingUtilizationPct || saved?.inputs.cuttingUtilizationPct}%</strong> → fabric required <strong>{shown.fabricRequiredKg} kg</strong>.</li>
                <li>kWh per kg × fabric required → knitting <strong>{shown.kwhPerGarment.knitting}</strong>, dyeing <strong>{shown.kwhPerGarment.dyeing}</strong>, fabric finishing <strong>{shown.kwhPerGarment.fabricFinishing}</strong> kWh per garment.</li>
                <li>Add cutting, sewing and garment-finishing kWh per garment → total <strong>{shown.totalEnergyKwh} kWh</strong>.</li>
                <li>Split by energy mix → grid <strong>{shown.gridEnergyKwh} kWh</strong>, solar <strong>{shown.solarEnergyKwh} kWh</strong>.</li>
                <li>Emission factors — grid <strong>{shownFactors.grid.value}</strong> ({shownFactors.grid.source}, {shownFactors.grid.yearVersion}); solar <strong>{shownFactors.solar.value}</strong> ({shownFactors.solar.source}, {shownFactors.solar.yearVersion}).</li>
                <li>Carbon = {shown.gridEnergyKwh} × {shownFactors.grid.value} + {shown.solarEnergyKwh} × {shownFactors.solar.value}.</li>
                <li>Result <strong>{shown.carbonKgCo2e} kg CO₂e per garment</strong>{saved?.results.calculatedAt ? `, calculated ${new Date(saved.results.calculatedAt).toLocaleString()}` : " (live preview — save to snapshot)"}. Factor values are snapshotted; later catalog edits never rewrite this record.</li>
              </ol>
            )}
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
