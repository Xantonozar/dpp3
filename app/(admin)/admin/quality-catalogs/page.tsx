"use client";

import { useEffect, useState } from "react";
import { FieldHint } from "@/components/ui/FieldHint";
import { HelpLink } from "@/components/ui/HelpLink";
import { TourHelpButton } from "@/components/TourHelpButton";

type Test = { testId: string; name: string; methods: { methodId?: string; label?: string; edition?: string; editionVerified?: boolean }[]; active?: boolean };
type Substance = { key: string; name: string; isGroup?: boolean; casNumbers: string[] };
type RSL = { _id: string; key: string; version: string; buyerProgram?: string; source?: string; market?: string; active?: boolean; criteria: { kind: string; refKey: string; operator: string; value: number; unit: string; methodId?: string }[] };

export default function QualityCatalogsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [subs, setSubs] = useState<Substance[]>([]);
  const [rsls, setRsls] = useState<RSL[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ key: "", version: "", buyerProgram: "", source: "", market: "", ageGroup: "" });
  const [crit, setCrit] = useState({ kind: "substance", refKey: "", operator: "<=", value: "", unit: "mg/kg", methodId: "" });

  async function load() {
    setErr("");
    try {
      const res = await fetch("/api/quality/catalogs").then((r) => r.json());
      setTests(res.data?.tests ?? []);
      setSubs(res.data?.substances ?? []);
      setRsls(res.data?.rsl ?? []);
    } catch {
      setErr("Couldn't reach the server — it may still be starting up. Refresh to retry.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleTest(testId: string, active: boolean) {
    setErr("");
    const res = await fetch("/api/quality/catalogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, active }),
    });
    if (!res.ok) setErr("Update failed");
    load();
  }

  async function verifyEdition(testId: string, methodId: string, editionVerified: boolean) {
    await fetch("/api/quality/catalogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, methodId, editionVerified }),
    });
    load();
  }

  async function createRsl(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/quality/catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        criteria: crit.refKey
          ? [{ ...crit, value: Number(crit.value), methodId: crit.methodId || undefined }]
          : [],
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Create failed");
      return;
    }
    setForm({ key: "", version: "", buyerProgram: "", source: "", market: "", ageGroup: "" });
    setCrit({ kind: "substance", refKey: "", operator: "<=", value: "", unit: "mg/kg", methodId: "" });
    setMsg("RSL profile created.");
    load();
  }

  async function deactivateRsl(id: string) {
    await fetch(`/api/quality/catalogs?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div data-tour="qc-header" className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-forest-950">Quality catalogs</h1>
          <p className="text-sm text-forest-900/60">
            12 tests, 11 substances (seeded) and RSL profiles. Limits change only here, with an
            audit entry — never in result entry. Saved results keep a frozen snapshot.
          </p>
        </div>
        <TourHelpButton tourKey="quality-catalogs" label="Quality catalogs" className="mt-1.5" />
      </div>
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}
      <nav aria-label="Catalog sections" className="flex gap-1.5 overflow-x-auto">
        {[
          ["qc-tests", `Tests · ${tests.length}`],
          ["qc-substances", `Substances · ${subs.length}`],
          ["qc-rsl", `RSL profiles · ${rsls.length}`],
        ].map(([anchor, label]) => (
          <a key={anchor} href={`#${anchor}`}
            className="whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-[13px] font-bold text-forest-800 ring-1 ring-forest-100 hover:bg-forest-50">
            {label}
          </a>
        ))}
      </nav>

      <div id="qc-tests" className="card scroll-mt-4 p-0">
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-3">
          <p className="text-sm font-extrabold text-forest-950">Tests · {tests.length}</p>
          <TourHelpButton tourKey="quality-catalogs" startId="qc-tests" label="Tests catalog" />
        </div>
        <ul className="divide-y divide-forest-50">
          {tests.map((t) => (
            <li key={t.testId} className="px-5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-forest-950">
                  {t.name}
                  <span className={`badge ml-2 ${t.active === false ? "bg-stone-100 text-stone-500" : "bg-forest-100 text-forest-800"}`}>
                    {t.active === false ? "Inactive" : "Active"}
                  </span>
                </p>
                <button onClick={() => toggleTest(t.testId, t.active === false)} className="btn-secondary !py-1.5 text-xs">
                  {t.active === false ? "Activate" : "Deactivate"}
                </button>
              </div>
              {(t.methods ?? []).map((m) => (
                <p key={m.methodId} className="mt-1 flex flex-wrap items-center gap-2 text-xs text-forest-900/60">
                  {m.label} · {m.edition}
                  <button
                    onClick={() => verifyEdition(t.testId, m.methodId ?? "", !m.editionVerified)}
                    className={`badge cursor-pointer ${m.editionVerified ? "bg-forest-700 text-white" : "bg-amber-100 text-amber-900"}`}>
                    {m.editionVerified ? "Edition verified" : "Edition unverified — confirm"}
                  </button>
                </p>
              ))}
            </li>
          ))}
          {tests.length === 0 && <li className="px-5 py-4 text-sm text-forest-900/60">Empty — run <code className="font-mono text-xs">npm run seed</code>.</li>}
        </ul>
      </div>

      <div id="qc-substances" className="card scroll-mt-4 p-0">
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-3">
          <p className="text-sm font-extrabold text-forest-950">Substances · {subs.length}</p>
          <TourHelpButton tourKey="quality-catalogs" startId="qc-substances" label="Substances catalog" />
        </div>
        <ul className="divide-y divide-forest-50">
          {subs.map((s) => (
            <li key={s.key} className="px-5 py-2 text-sm">
              <strong className="text-forest-950">{s.name}</strong>{" "}
              <span className="text-forest-900/60">
                {s.isGroup || s.casNumbers.length === 0 ? "Multiple - see substance list" : `CAS ${s.casNumbers.join(", ")}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div id="qc-rsl" className="card scroll-mt-4 p-0">
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-3">
          <p className="text-sm font-extrabold text-forest-950">RSL profiles · {rsls.length}</p>
          <TourHelpButton tourKey="quality-catalogs" startId="qc-rsl" label="RSL profiles" />
        </div>
        <ul className="divide-y divide-forest-50">
          {rsls.map((r) => (
            <li key={r._id} className="px-5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-forest-950">
                  {r.key} v{r.version}
                  <span className="ml-2 text-xs font-medium text-forest-900/60">
                    {r.buyerProgram} · {r.market} · {r.criteria.length} criteria
                  </span>
                </p>
                <button onClick={() => deactivateRsl(r._id)} className="btn-secondary !py-1.5 text-xs">Deactivate</button>
              </div>
            </li>
          ))}
          {rsls.length === 0 && <li className="px-5 py-4 text-sm text-forest-900/60">No profiles — results save as REVIEW REQUIRED until one exists.</li>}
        </ul>
        <form onSubmit={createRsl} className="grid gap-2 border-t border-forest-100 p-5 sm:grid-cols-3">
          <input className="input" placeholder="Key *" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
          <input className="input" placeholder="Version *" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} required />
          <input className="input" placeholder="Buyer / programme" value={form.buyerProgram} onChange={(e) => setForm({ ...form, buyerProgram: e.target.value })} />
          <input className="input" placeholder="Source (RSL / regulation)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <input className="input" placeholder="Market" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} />
          <input className="input" placeholder="Age group" value={form.ageGroup} onChange={(e) => setForm({ ...form, ageGroup: e.target.value })} />
          <div className="grid gap-2 sm:col-span-3 sm:grid-cols-5">
            <select className="input" value={crit.kind} onChange={(e) => setCrit({ ...crit, kind: e.target.value })} aria-label="Criterion kind">
              <option value="substance">substance</option><option value="test">test</option>
            </select>
            <input className="input" placeholder="refKey (testId / substance)" value={crit.refKey} onChange={(e) => setCrit({ ...crit, refKey: e.target.value })} />
            <select className="input" value={crit.operator} onChange={(e) => setCrit({ ...crit, operator: e.target.value })} aria-label="Operator">
              <option>{"<="}</option><option>{"<"}</option><option>{">="}</option><option>{">"}</option><option>range</option>
            </select>
            <input className="input" placeholder="value" inputMode="decimal" value={crit.value} onChange={(e) => setCrit({ ...crit, value: e.target.value })} />
            <input className="input" placeholder="unit" value={crit.unit} onChange={(e) => setCrit({ ...crit, unit: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <FieldHint>
              refKey must exactly match the key the result uses — e.g. <code className="font-mono">apeo</code> or{" "}
              <code className="font-mono">formaldehyde</code> for substances, <code className="font-mono">colour_rubbing</code>{" "}
              for tests. Unit must match the unit entered on the result, or the verdict stays REVIEW REQUIRED.{" "}
              <HelpLink anchor="help-verdicts" label="How verdicts are derived" />
            </FieldHint>
          </div>
          <div className="sm:col-span-3"><button className="btn-primary !py-2 text-xs" type="submit">Create profile</button></div>
        </form>
      </div>
    </div>
  );
}
