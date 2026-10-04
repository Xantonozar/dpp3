"use client";

import { useEffect, useState } from "react";
import { HelpLink } from "@/components/ui/HelpLink";
import { TourHelpButton } from "@/components/TourHelpButton";

type Factor = {
  _id: string;
  key: string;
  type: "grid" | "solar";
  kgCo2ePerKwh: number;
  source: string;
  yearVersion: string;
  methodology?: string;
  active: boolean;
};

const blank = { key: "", type: "grid", kgCo2ePerKwh: "", source: "", yearVersion: "", methodology: "" };

export default function EmissionFactorsPage() {
  const [rows, setRows] = useState<Factor[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVals, setEditVals] = useState({ kgCo2ePerKwh: "", source: "", yearVersion: "", methodology: "" });
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/emission-factors");
      const body = await res.json();
      setRows(body.data ?? []);
      if (!res.ok) setErr(body.error ?? `Failed to load (HTTP ${res.status}).`);
    } catch {
      setErr("Couldn't reach the server — it may still be starting up. Refresh to retry.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/emission-factors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, kgCo2ePerKwh: Number(form.kgCo2ePerKwh) }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Create failed");
      return;
    }
    setForm(blank);
    setMsg(`Factor “${body.data.key}” added.`);
    load();
  }

  async function patch(id: string, patch: object) {
    setErr("");
    const res = await fetch(`/api/emission-factors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Update failed");
      return;
    }
    setEditing(null);
    load();
  }

  function startEdit(f: Factor) {
    setEditing(f._id);
    setEditVals({
      kgCo2ePerKwh: String(f.kgCo2ePerKwh),
      source: f.source,
      yearVersion: f.yearVersion,
      methodology: f.methodology ?? "",
    });
  }

  return (
    <div className="space-y-4">
      <div data-tour="ef-header" className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-forest-950">Emission factors</h1>
          <p className="text-sm text-forest-900/60">
            No values are seeded. Add the grid and solar factors with a documented source and
            year / version — carbon cannot be calculated until both exist. Saved product records
            keep a snapshot; editing a factor never rewrites history.{" "}
            <HelpLink anchor="help-carbon" label="How carbon is calculated" />
          </p>
        </div>
        <TourHelpButton tourKey="emission-factors" label="Emission factors" className="mt-1.5" />
      </div>
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <form data-tour="ef-form" onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ef-key">Key *</label>
          <input id="ef-key" className="input" placeholder="grid_bd_2024" value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="ef-type">Type *</label>
          <select id="ef-type" className="input" value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="grid">grid</option>
            <option value="solar">solar</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ef-val">kg CO₂e / kWh *</label>
          <input id="ef-val" className="input" inputMode="decimal" placeholder="e.g. 0.50" value={form.kgCo2ePerKwh}
            onChange={(e) => setForm({ ...form, kgCo2ePerKwh: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="ef-year">Year / version *</label>
          <input id="ef-year" className="input" placeholder="e.g. 2024" value={form.yearVersion}
            onChange={(e) => setForm({ ...form, yearVersion: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-src">Source *</label>
          <input id="ef-src" className="input" placeholder="e.g. National grid inventory 2024" value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary" type="submit">Add factor</button>
        </div>
      </form>

      <div data-tour="ef-list" className="card p-0">
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-3">
          <p className="text-sm font-extrabold text-forest-950">{rows.length} factor(s)</p>
          <TourHelpButton tourKey="emission-factors" startId="ef-list" label="Saved factors" />
        </div>
        <ul className="divide-y divide-forest-50">
          {rows.map((f) => (
            <li key={f._id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-forest-950">
                  {f.key} <span className="font-mono font-semibold text-forest-900/50">· {f.type} · {f.kgCo2ePerKwh} kg/kWh</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className={`badge ${f.active ? "bg-forest-100 text-forest-800" : "bg-stone-100 text-stone-500"}`}>
                    {f.active ? "Active" : "Inactive"}
                  </span>
                  <button onClick={() => startEdit(f)} className="btn-secondary !py-1.5 text-xs">Edit</button>
                  <button onClick={() => patch(f._id, { active: !f.active })} className="btn-secondary !py-1.5 text-xs">
                    {f.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-forest-900/60">{f.source} · {f.yearVersion}</p>
              {editing === f._id && (
                <div className="mt-2 grid gap-2 rounded-xl bg-forest-50/60 p-3 sm:grid-cols-2">
                  <input className="input" aria-label="Value" value={editVals.kgCo2ePerKwh}
                    onChange={(e) => setEditVals({ ...editVals, kgCo2ePerKwh: e.target.value })} />
                  <input className="input" aria-label="Year" value={editVals.yearVersion}
                    onChange={(e) => setEditVals({ ...editVals, yearVersion: e.target.value })} />
                  <input className="input sm:col-span-2" aria-label="Source" value={editVals.source}
                    onChange={(e) => setEditVals({ ...editVals, source: e.target.value })} />
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={() => patch(f._id, {
                        kgCo2ePerKwh: Number(editVals.kgCo2ePerKwh),
                        source: editVals.source,
                        yearVersion: editVals.yearVersion,
                        methodology: editVals.methodology || undefined,
                      })}
                      className="btn-primary !py-1.5 text-xs">Save</button>
                    <button onClick={() => setEditing(null)} className="btn-secondary !py-1.5 text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {rows.length === 0 && !busy && (
            <li className="px-5 py-6 text-center text-sm text-forest-900/60">
              No factors yet — carbon is not computed until an active grid and solar factor exist.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
