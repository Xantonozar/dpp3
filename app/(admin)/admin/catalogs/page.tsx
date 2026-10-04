"use client";

import { useEffect, useState } from "react";
import { TourHelpButton } from "@/components/TourHelpButton";

const LISTS = [
  "fabric_type",
  "fiber_type",
  "trim_component",
  "yarn_type",
  "packaging_type",
  "packaging_material",
  "recyclability",
  "record_type",
  "category",
  "applicable_to",
  "tier_stage",
  "evidence_type",
  "verification_method",
  "country",
  "size_systems",
];

type Opt = { code?: string; key?: string; label?: string; name?: string; active?: boolean };
type Std = { catalogId: string; displayName?: string; active?: boolean };

export default function CatalogsPage() {
  const [list, setList] = useState("fiber_type");
  const [rows, setRows] = useState<Opt[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [newOpt, setNewOpt] = useState({ code: "", label: "" });
  const [stds, setStds] = useState<Std[]>([]);
  const [newStd, setNewStd] = useState({ catalogId: "", displayName: "" });

  const editable = list !== "size_systems";
  const shown = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return `${r.label ?? r.name ?? ""} ${r.code ?? r.key ?? ""}`.toLowerCase().includes(s);
  });

  async function load(l = list) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/catalogs/${l}`);
      const body = await res.json();
      setRows(body.data ?? []);
      if (!res.ok) setMsg(body.error ?? `Failed to load (HTTP ${res.status}).`);
    } catch {
      setMsg("Couldn't reach the server — it may still be starting up. Refresh to retry.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  useEffect(() => {
    fetch("/api/certifications/catalog")
      .then((r) => r.json())
      .then((b) => setStds(b.data ?? []))
      .catch(() => setStds([]));
  }, []);

  async function toggleOpt(code: string, active: boolean) {
    setMsg("");
    const res = await fetch(`/api/catalogs/${list}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, active }),
    });
    if (!res.ok) {
      const b = await res.json();
      setMsg(b.error ?? "Update failed.");
      return;
    }
    load();
  }

  async function addOpt(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`/api/catalogs/${list}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newOpt.code.trim(), label: newOpt.label.trim() }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMsg(body.error ?? "Could not add option.");
      return;
    }
    setNewOpt({ code: "", label: "" });
    load();
  }

  async function toggleStd(catalogId: string, active: boolean) {
    await fetch("/api/certifications/catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, active }),
    });
    const b = await fetch("/api/certifications/catalog").then((r) => r.json());
    setStds(b.data ?? []);
  }

  async function addStd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/certifications/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId: newStd.catalogId, displayName: newStd.displayName }),
    });
    if (!res.ok) {
      setMsg("Could not add standard.");
      return;
    }
    setNewStd({ catalogId: "", displayName: "" });
    const b = await fetch("/api/certifications/catalog").then((r) => r.json());
    setStds(b.data ?? []);
  }

  return (
    <div className="space-y-4">
      <div data-tour="cat-header" className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-forest-950">
            Catalogs
          </h1>
          <p className="text-sm text-forest-900/60">
            Dropdown options and size systems. Tests, substances and RSL live under{" "}
            <a href="/admin/quality-catalogs" className="font-bold text-forest-700 underline">Quality catalogs</a>,
            emission factors under <a href="/admin/emission-factors" className="font-bold text-forest-700 underline">Emission factors</a>.
            Deactivate — never delete — to keep history.
          </p>
        </div>
        <TourHelpButton tourKey="catalogs" label="Catalogs" className="mt-1.5" />
      </div>
      <div data-tour="cat-picker" className="flex flex-wrap gap-2">
        {LISTS.map((l) => (
          <button
            key={l}
            onClick={() => { setList(l); setQ(""); setNewOpt({ code: "", label: "" }); }}
            className={`badge cursor-pointer ring-1 ${
              l === list
                ? "bg-forest-700 text-white ring-forest-700"
                : "bg-white text-forest-800 ring-forest-200 hover:bg-forest-50"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div data-tour="cat-options" className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-100 px-5 py-3">
          <p className="text-sm font-extrabold text-forest-950">
            {list} · {shown.length}/{rows.length}
          </p>
          <div className="flex gap-2">
            <input className="input !w-52 !py-1.5 text-xs" placeholder="Search options…"
              value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search options" />
            <button onClick={() => load()} className="btn-secondary !py-1.5 text-xs">
              {busy ? "Loading…" : "Reload"}
            </button>
            <TourHelpButton tourKey="catalogs" startId="cat-options" label="Options list" />
          </div>
        </div>
        {msg && <p className="px-5 py-3 text-sm text-red-700">{msg}</p>}
        <ul className="divide-y divide-forest-50">
          {shown.map((r, i) => {
            const code = r.code ?? r.key ?? "";
            return (
              <li key={`${code}-${i}`} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-semibold text-forest-950">
                  {(r.label ?? r.name ?? r.code ?? r.key) as string}
                  <span className="ml-2 font-mono text-xs font-normal text-forest-900/50">
                    {code}
                  </span>
                </span>
                {editable && code ? (
                  <button onClick={() => toggleOpt(code, r.active === false)} className="btn-secondary !py-1.5 text-xs">
                    {r.active === false ? "Activate" : "Deactivate"}
                  </button>
                ) : (
                  <span
                    className={`badge ${r.active === false ? "bg-stone-100 text-stone-500" : "bg-forest-100 text-forest-800"}`}
                  >
                    {r.active === false ? "Inactive" : "Active"}
                  </span>
                )}
              </li>
            );
          })}
          {shown.length === 0 && !busy && (
            <li className="px-5 py-6 text-center text-sm text-forest-900/60">
              {rows.length === 0 ? (
                <>Empty — run{" "}
                  <code className="rounded bg-forest-50 px-1 font-mono text-xs">
                    npm run seed
                  </code>{" "}
                  to load catalog seeds.</>
              ) : (
                <>No options match “{q}”.</>
              )}
            </li>
          )}
        </ul>
        {editable && (
          <form onSubmit={addOpt} className="flex flex-wrap gap-2 border-t border-forest-100 p-4">
            <input className="input !w-40" placeholder="code (e.g. hemp)" value={newOpt.code}
              onChange={(e) => setNewOpt({ ...newOpt, code: e.target.value })} required aria-label="Option code" />
            <input className="input !w-64" placeholder="Label (e.g. Hemp)" value={newOpt.label}
              onChange={(e) => setNewOpt({ ...newOpt, label: e.target.value })} required aria-label="Option label" />
            <button className="btn-secondary !py-2 text-xs" type="submit">Add option</button>
          </form>
        )}
      </div>
      <div data-tour="cat-stds" className="card p-0">
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-3">
          <p className="text-sm font-extrabold text-forest-950">
            Certification standards · {stds.length}
          </p>
          <TourHelpButton tourKey="catalogs" startId="cat-stds" label="Certification standards" />
        </div>
        <ul className="divide-y divide-forest-50">
          {stds.map((s) => (
            <li key={s.catalogId} className="flex items-center justify-between px-5 py-2.5">
              <span className="text-sm font-semibold text-forest-950">
                {s.displayName}
                <span className="ml-2 font-mono text-xs font-normal text-forest-900/50">{s.catalogId}</span>
              </span>
              <button onClick={() => toggleStd(s.catalogId, s.active === false)} className="btn-secondary !py-1.5 text-xs">
                {s.active === false ? "Activate" : "Deactivate"}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addStd} className="flex flex-wrap gap-2 border-t border-forest-100 p-4">
          <input className="input !w-28" placeholder="ID" value={newStd.catalogId} onChange={(e) => setNewStd({ ...newStd, catalogId: e.target.value })} required aria-label="Catalog ID" />
          <input className="input !w-64" placeholder="Display name" value={newStd.displayName} onChange={(e) => setNewStd({ ...newStd, displayName: e.target.value })} required aria-label="Display name" />
          <button className="btn-secondary !py-2 text-xs" type="submit">Add standard</button>
        </form>
      </div>
    </div>
  );
}
