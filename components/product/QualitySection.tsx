"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FieldHint } from "@/components/ui/FieldHint";
import { HelpLink } from "@/components/ui/HelpLink";

type Method = { methodId?: string; label?: string; edition?: string; editionVerified?: boolean; note?: string };
type SchemaField = { key: string; label: string; type: string; unit?: string; scale?: string; options?: string[]; required?: boolean };
type Test = { testId: string; name: string; category: string; methods: Method[]; applicability: string[]; shortSummary?: string; expandedSummary?: string; resultSchema: SchemaField[]; active?: boolean };
type Substance = { key: string; name: string; isGroup?: boolean; casNumbers: string[]; components: string[] };
type Criterion = { kind: string; refKey: string; operator: string; value: number; valueMax?: number; unit: string; methodId?: string };
type RSL = { key: string; version: string; buyerProgram?: string; source?: string; market?: string; ageGroup?: string; productType?: string; components: string[]; effectiveDate?: string; criteria: Criterion[]; active?: boolean };
type Report = { _id: string; labName: string; reportNumber: string; overallResult: string; accreditation?: { body?: string; certificateRef?: string }; reviewedBy?: string; reviewerDesignation?: string; signOffDate?: string };
type Result = {
  _id: string; kind: string; testId?: string; substanceKey?: string; methodId?: string;
  resultState: string; result: Record<string, unknown>; reportingLimit?: number; unit?: string;
  testDate?: string; component?: string; rslProfile?: { key: string; version: string };
  criterionSnapshot?: Criterion; status: string; published: boolean;
};

const GREY_GRADES = ["1", "1-2", "2", "2-3", "3", "3-4", "4", "4-5", "5"];
const BLUE_WOOL = ["1", "2", "3", "4", "5", "6", "7", "8"];
const GREY_AID: [string, string][] = [["5", "Excellent"], ["4-5", "Very good"], ["4", "Good"], ["3-4", "Fairly good"], ["3", "Fair"], ["2-3", "Poor to fair"], ["2", "Poor"], ["1-2 / 1", "Very poor"]];

function pillTone(s: string) {
  if (s === "PASS") return "ok";
  if (s === "FAIL") return "error";
  if (s === "REVIEW REQUIRED") return "warn";
  return "neutral";
}

// Explains WHY a result got REVIEW REQUIRED and exactly how to fix it.
function reviewHint(r: Result, formAnchor: "crsl" | "prsl") {
  const key = r.substanceKey ?? r.testId ?? "this item";
  if (!r.rslProfile) {
    return (
      <p className="mt-1 text-xs font-semibold text-amber-700">
        No RSL profile was selected, so no verdict was evaluated. Pick a profile in the form
        below (<a href={`#${formAnchor}`} className="underline">jump to profile</a>), then
        delete and re-add this result — saved results are never re-evaluated.
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs font-semibold text-amber-700">
      Profile <b>{r.rslProfile.key} v{r.rslProfile.version}</b> has no rule for{" "}
      <code className="font-mono">{key}</code>. Add a criterion with refKey{" "}
      <code className="font-mono">{key}</code> (it must match the substance/test key) in{" "}
      <a href="/admin/quality-catalogs#qc-rsl" className="underline">Quality catalogs →</a>,
      then delete and re-add this result.
    </p>
  );
}

function resultHeadline(r: Result, tests: Test[], substances: Substance[]) {
  if (r.kind === "physical") {
    const t = tests.find((x) => x.testId === r.testId);
    const vals = Object.entries(r.result ?? {})
      .filter(([, v]) => v !== "" && v != null)
      .map(([, v]) => String(v));
    return { name: t?.name ?? r.testId ?? "Test", detail: vals.join(" · ") || r.resultState };
  }
  const s = substances.find((x) => x.key === r.substanceKey);
  const v = r.resultState === "ND" ? `ND (<${r.reportingLimit})` : Object.values(r.result ?? {})[0] as string;
  return { name: s?.name ?? r.substanceKey ?? "Substance", detail: `${v ?? ""} ${r.unit ?? ""}`.trim() || r.resultState };
}

export function QualitySection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [tests, setTests] = useState<Test[]>([]);
  const [substances, setSubstances] = useState<Substance[]>([]);
  const [rsls, setRsls] = useState<RSL[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgFor, setMsgFor] = useState("");
  const [secMsg, setSecMsg] = useState("");
  const [err, setErr] = useState("");

  // report form
  const [rep, setRep] = useState({ labName: "", reportNumber: "", overallResult: "Not Tested", body: "", certificateRef: "", scopeRef: "", reviewedBy: "", reviewerDesignation: "", signOffDate: "" });
  const [repFile, setRepFile] = useState<{ publicId: string; secureUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // physical form
  const [testQ, setTestQ] = useState("");
  const [testId, setTestId] = useState("");
  const [pVals, setPVals] = useState<Record<string, string>>({});
  const [pMethod, setPMethod] = useState("");
  const [pReport, setPReport] = useState("");
  const [pRsl, setPRsl] = useState("");
  const [pDate, setPDate] = useState("");
  const [pComp, setPComp] = useState("");
  const [showMethod, setShowMethod] = useState(false);

  // chemical form
  const [subQ, setSubQ] = useState("");
  const [subKey, setSubKey] = useState("");
  const [cState, setCState] = useState("Value");
  const [cValue, setCValue] = useState("");
  const [cUnit, setCUnit] = useState("mg/kg");
  const [cLimit, setCLimit] = useState("");
  const [cRsl, setCRsl] = useState("");
  const [cComp, setCComp] = useState("");

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [cat, repL, resL] = await Promise.all([
      fetch("/api/quality/catalogs").then((r) => r.json()),
      fetch(`/api/products/${pid}/quality/reports`).then((r) => r.json()),
      fetch(`/api/products/${pid}/quality/results`).then((r) => r.json()),
    ]);
    setTests((cat.data?.tests ?? []).filter((t: Test) => t.active !== false));
    setSubstances((cat.data?.substances ?? []).filter((s: Substance) => (s as Substance & { active?: boolean }).active !== false));
    setRsls((cat.data?.rsl ?? []).filter((r: RSL) => r.active !== false));
    setReports(repL.data ?? []);
    setResults(resL.data ?? []);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (id) load(id).catch((e) => {
      setErr(e instanceof Error ? e.message : "Load failed");
      setBusy(false);
    });
  }, [id, load]);

  const selTest = useMemo(() => tests.find((t) => t.testId === testId), [tests, testId]);
  const selSub = useMemo(() => substances.find((s) => s.key === subKey), [substances, subKey]);
  const testMatches = useMemo(() => {
    const q = testQ.trim().toLowerCase();
    if (!q) return tests.slice(0, 20);
    return tests.filter((t) => (t.name + " " + t.testId).toLowerCase().includes(q)).slice(0, 20);
  }, [tests, testQ]);
  const subMatches = useMemo(() => {
    const q = subQ.trim().toLowerCase();
    if (!q) return substances.slice(0, 20);
    return substances.filter((s) => (s.name + " " + (s.casNumbers ?? []).join(" ")).toLowerCase().includes(q)).slice(0, 20);
  }, [substances, subQ]);

  async function uploadReport(file: File) {
    if (file.size > 15_000_000) {
      setErr("Report too large (max 15 MB).");
      return;
    }
    setUploading(true);
    try {
      const sign = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "lab_report", productId: id }),
      }).then((r) => r.json());
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", String(sign.timestamp));
      fd.append("folder", sign.folder);
      fd.append("type", sign.type);
      fd.append("signature", sign.signature);
      const up = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`, { method: "POST", body: fd });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error?.message ?? "Upload failed");
      setRepFile({ publicId: data.public_id, secureUrl: data.secure_url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function addReport(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch(`/api/products/${id}/quality/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labName: rep.labName,
        reportNumber: rep.reportNumber,
        overallResult: rep.overallResult,
        accreditation: { body: rep.body || undefined, certificateRef: rep.certificateRef || undefined, scopeRef: rep.scopeRef || undefined },
        reviewedBy: rep.reviewedBy || undefined,
        reviewerDesignation: rep.reviewerDesignation || undefined,
        signOffDate: rep.signOffDate || undefined,
        reportFile: repFile ?? undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Save failed");
      return;
    }
    setRep({ labName: "", reportNumber: "", overallResult: "Not Tested", body: "", certificateRef: "", scopeRef: "", reviewedBy: "", reviewerDesignation: "", signOffDate: "" });
    setRepFile(null);
    setMsg("Lab report saved.");
    setMsgFor("report");
    setSecMsg("");
    load(id);
  }

  async function addPhysical(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!selTest) {
      setErr("Select a test first.");
      return;
    }
    const res = await fetch(`/api/products/${id}/quality/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "physical",
        testId: selTest.testId,
        methodId: pMethod || selTest.methods[0]?.methodId,
        methodEdition: selTest.methods[0]?.edition,
        labReportId: pReport || undefined,
        result: pVals,
        unit: selTest.resultSchema.find((f) => f.unit)?.unit,
        scale: selTest.resultSchema.find((f) => f.scale)?.scale,
        rslProfile: pRsl ? JSON.parse(pRsl) : undefined,
        testDate: pDate || undefined,
        component: pComp || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Save failed");
      return;
    }
    setMsg(`Saved — ${body.data.status}. ${body.evaluation ?? ""}`);
    setMsgFor("physical");
    setSecMsg("");
    setPVals({});
    load(id);
  }

  async function addChemical(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!selSub) {
      setErr("Select a substance first.");
      return;
    }
    const res = await fetch(`/api/products/${id}/quality/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "chemical",
        substanceKey: selSub.key,
        resultState: cState,
        result: cState === "Value" ? { value: cValue } : {},
        reportingLimit: cState === "ND" && cLimit ? Number(cLimit) : undefined,
        unit: cUnit || undefined,
        rslProfile: cRsl ? JSON.parse(cRsl) : undefined,
        component: cComp || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Save failed");
      return;
    }
    setMsg(`Saved — ${body.data.status}. ${body.evaluation ?? ""}`);
    setMsgFor("chemical");
    setSecMsg("");
    setCValue("");
    setCLimit("");
    load(id);
  }

  async function togglePublish(r: Result) {
    await fetch(`/api/products/${id}/quality/results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _id: r._id, published: !r.published }),
    });
    load(id);
  }

  async function delResult(r: Result) {
    if (!window.confirm("Delete this result?")) return;
    await fetch(`/api/products/${id}/quality/results?rid=${r._id}`, { method: "DELETE" });
    load(id);
  }

  const physical = results.filter((r) => r.kind === "physical");
  const chemical = results.filter((r) => r.kind === "chemical");

  // Section Save: quality entries save one by one — this checks the three
  // entry forms and either confirms everything is saved or jumps to the
  // unfinished entry so its own Save button can be pressed.
  const dirtyForms = useMemo(() => {
    const d: { label: string; form: string }[] = [];
    if (rep.labName.trim() || rep.reportNumber.trim() || repFile || rep.reviewedBy.trim() || rep.signOffDate) {
      d.push({ label: "4.1 lab report", form: "qform-report" });
    }
    if (subKey || cValue.trim() || cLimit.trim() || cRsl || cComp.trim()) {
      d.push({ label: "4.2 chemical result", form: "qform-chemical" });
    }
    if (
      testId || pRsl || pReport || pDate || pComp.trim() ||
      Object.values(pVals).some((v) => String(v ?? "").trim() !== "")
    ) {
      d.push({ label: "4.3 test result", form: "qform-physical" });
    }
    return d;
  }, [rep, repFile, subKey, cValue, cLimit, cRsl, cComp, testId, pVals, pRsl, pReport, pDate, pComp]);

  function saveSection() {
    if (dirtyForms.length === 0) {
      setSecMsg("✓ Everything in this section is already saved.");
      return;
    }
    const first = dirtyForms[0];
    setSecMsg(
      `You have an unfinished entry in ${first.label} — press its Save button to save it. Quality entries save one by one.`
    );
    document.getElementById(first.form)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading quality…</div>;

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-forest-50 px-4 py-2.5 text-xs font-semibold text-forest-900/70 ring-1 ring-forest-100">
        Each report and result below saves individually the moment you submit its form — there is no section-wide draft. A confirmation appears under the form you just saved.
      </p>
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <CollapsibleSection id="quality" level={1} help={() => startTour("quality", "quality")} title="4. Quality & Lab Testing"
        summary={`${reports.length} report(s) · ${physical.length} test(s) · ${chemical.length} chemical(s)`} defaultOpen>
        <div className="space-y-3">
          {/* 4.1 */}
          <CollapsibleSection id="quality-facility" level={2} help={() => startTour("quality", "quality-facility")} title="4.1 Testing Facility & Certification"
            summary={`${reports.length} report(s)`} defaultOpen>
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r._id} className="rounded-xl bg-white px-4 py-3 ring-1 ring-forest-100">
                  <p className="text-sm font-extrabold text-forest-950">
                    {r.labName} · <span className="font-mono">{r.reportNumber}</span>
                    <span className="badge ml-2 bg-forest-100 text-forest-800">{r.overallResult}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-forest-900/60">
                    {r.accreditation?.body && r.accreditation?.certificateRef ? "Accredited" : "Report provided"}
                    {r.reviewedBy ? ` · ${r.reviewedBy}${r.reviewerDesignation ? `, ${r.reviewerDesignation}` : ""}` : ""}
                  </p>
                </div>
              ))}
              {reports.length === 0 && <p className="text-sm text-forest-900/60">No lab reports yet — add one with the form below.</p>}
            </div>
            <form id="qform-report" onSubmit={addReport} className="mt-4 grid gap-3 rounded-xl bg-forest-50/60 p-4 ring-1 ring-forest-100 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="lr-name">Lab name *</label>
                <input id="lr-name" className="input" value={rep.labName} onChange={(e) => setRep({ ...rep, labName: e.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="lr-num">Report number *</label>
                <input id="lr-num" className="input font-mono" value={rep.reportNumber} onChange={(e) => setRep({ ...rep, reportNumber: e.target.value })} placeholder="00123-A" required />
              </div>
              <div>
                <label className="label" htmlFor="lr-overall">Overall result</label>
                <select id="lr-overall" className="input" value={rep.overallResult} onChange={(e) => setRep({ ...rep, overallResult: e.target.value })}>
                  <option>Pass</option><option>Fail</option><option>Conditional Pass</option><option>Not Tested</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="lr-pdf">Report PDF (private)</label>
                <input id="lr-pdf" type="file" accept="application/pdf" className="input"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReport(f); e.target.value = ""; }} />
                {uploading && <p className="text-xs">Uploading…</p>}
                {repFile && <p className="text-xs font-semibold text-forest-700">✓ {repFile.publicId}</p>}
              </div>
              <div>
                <label className="label" htmlFor="lr-body">Accreditation body</label>
                <input id="lr-body" className="input" value={rep.body} onChange={(e) => setRep({ ...rep, body: e.target.value })} placeholder="Empty → “Report provided”" />
              </div>
              <div>
                <label className="label" htmlFor="lr-cert">Accreditation certificate ref</label>
                <input id="lr-cert" className="input" value={rep.certificateRef} onChange={(e) => setRep({ ...rep, certificateRef: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="lr-rb">Reviewer name</label>
                <input id="lr-rb" className="input" value={rep.reviewedBy} onChange={(e) => setRep({ ...rep, reviewedBy: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="lr-rd">Reviewer designation</label>
                <input id="lr-rd" className="input" value={rep.reviewerDesignation} onChange={(e) => setRep({ ...rep, reviewerDesignation: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="lr-date">Sign-off date</label>
                <input id="lr-date" type="date" className="input" value={rep.signOffDate} onChange={(e) => setRep({ ...rep, signOffDate: e.target.value })} />
              </div>
              <div className="flex items-end">
                <button className="btn-primary !py-2.5 text-xs" type="submit">Add report</button>
              </div>
              {msg && msgFor === "report" && (
                <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800 sm:col-span-2">{msg}</p>
              )}
            </form>
          </CollapsibleSection>

          {/* 4.2 */}
          <CollapsibleSection id="quality-chemicals" level={2} help={() => startTour("quality", "quality-chemicals")} title="4.2 Chemicals & Restricted Substances"
            summary={`${chemical.length} result(s)`}>
            <div className="space-y-2">
              {chemical.map((r) => {
                const h = resultHeadline(r, tests, substances);
                return (
                  <CollapsibleSection key={r._id} id={`chem-${r._id}`} level={3}
                    title={h.name} summary={`${h.detail} · ${r.status}`}>
                    <StatusBadge tone={pillTone(r.status)}>{r.status}</StatusBadge>
                    {r.status === "REVIEW REQUIRED" && reviewHint(r, "crsl")}
                    {r.criterionSnapshot && (
                      <p className="mt-1 text-xs text-forest-900/60">
                        Criterion: {r.criterionSnapshot.operator} {r.criterionSnapshot.value} {r.criterionSnapshot.unit}
                        {r.rslProfile ? ` · ${r.rslProfile.key} v${r.rslProfile.version}` : ""}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => togglePublish(r)} className="btn-secondary !py-1.5 text-xs">
                        {r.published ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => delResult(r)} className="btn-secondary !py-1.5 text-xs !text-red-700">Delete</button>
                    </div>
                  </CollapsibleSection>
                );
              })}
              {chemical.length === 0 && <p className="text-sm text-forest-900/60">No chemical results yet — pick a substance in the form below.</p>}
            </div>
            <form id="qform-chemical" onSubmit={addChemical} className="mt-4 space-y-3 rounded-xl bg-forest-50/60 p-4 ring-1 ring-forest-100">
              <div>
                <label className="label" htmlFor="sub-q">Select substance</label>
                <input id="sub-q" className="input" placeholder="Search name or CAS…" value={subQ} onChange={(e) => setSubQ(e.target.value)} />
                <div className="mt-1.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                  {subMatches.map((s) => (
                    <button type="button" key={s.key} onClick={() => setSubKey(s.key)}
                      className={`badge cursor-pointer ring-1 ${subKey === s.key ? "bg-forest-700 text-white ring-forest-700" : "bg-white text-forest-800 ring-forest-200"}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
                {selSub && (
                  <p className="mt-1.5 text-xs text-forest-900/60">
                    {selSub.isGroup || selSub.casNumbers.length === 0
                      ? "Multiple - see substance list"
                      : `CAS ${selSub.casNumbers.join(", ")}`}
                    {(selSub.components ?? []).length > 0 && ` · ${selSub.components.join(", ")}`}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="cs">Result state</label>
                  <select id="cs" className="input" value={cState} onChange={(e) => setCState(e.target.value)}>
                    <option>Value</option><option>ND</option><option>Not Tested</option><option>Not Applicable</option><option>Unknown</option>
                  </select>
                </div>
                {cState === "Value" && (
                  <>
                    <div>
                      <label className="label" htmlFor="cv">Result value *</label>
                      <input id="cv" className="input" inputMode="decimal" value={cValue} onChange={(e) => setCValue(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="cu">Unit</label>
                      <input id="cu" className="input" value={cUnit} onChange={(e) => setCUnit(e.target.value)} />
                    </div>
                  </>
                )}
                {cState === "ND" && (
                  <>
                    <div>
                      <label className="label" htmlFor="cl">Reporting limit * (never 0)</label>
                      <input id="cl" className="input" inputMode="decimal" value={cLimit} onChange={(e) => setCLimit(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="cu2">Unit</label>
                      <input id="cu2" className="input" value={cUnit} onChange={(e) => setCUnit(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="crsl">RSL profile (limits come from here)</label>
                  <select id="crsl" className="input" value={cRsl} onChange={(e) => setCRsl(e.target.value)}>
                    <option value="">No profile — saved without a verdict</option>
                    {rsls.map((r) => (
                      <option key={r.key + r.version} value={JSON.stringify({ key: r.key, version: r.version })}>
                        {r.key} v{r.version}{r.buyerProgram ? ` · ${r.buyerProgram}` : ""}{r.market ? ` · ${r.market}` : ""}
                      </option>
                    ))}
                  </select>
                  {rsls.length === 0 && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      No profiles yet — <a href="/admin/quality-catalogs#qc-rsl" className="underline">create one in Quality catalogs →</a>
                    </p>
                  )}
                  <FieldHint>
                    The verdict comes from this profile&apos;s criteria — key and unit must match your
                    entry. Choose it before saving: saved results are never re-evaluated.{" "}
                    <HelpLink anchor="help-verdicts" label="Why verdicts show REVIEW REQUIRED" />
                  </FieldHint>
                </div>
                <div>
                  <label className="label" htmlFor="cc">Component scope</label>
                  <input id="cc" className="input" value={cComp} onChange={(e) => setCComp(e.target.value)} placeholder="e.g. Main fabric" />
                </div>
              </div>
              <button className="btn-primary !py-2.5 text-xs" type="submit">Save chemical result</button>
              {msg && msgFor === "chemical" && (
                <p className="mt-2 rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>
              )}
            </form>
          </CollapsibleSection>

          {/* 4.3 */}
          <CollapsibleSection id="quality-testing" level={2} help={() => startTour("quality", "quality-testing")} title="4.3 Testing"
            summary={`${physical.length} result(s)`} defaultOpen>
            <div className="space-y-2">
              {physical.map((r) => {
                const h = resultHeadline(r, tests, substances);
                const t = tests.find((x) => x.testId === r.testId);
                return (
                  <CollapsibleSection key={r._id} id={`test-${r._id}`} level={3}
                    title={h.name} summary={`${h.detail} · ${r.status}`}>
                    {/* consumer test card */}
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-forest-100">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-forest-700">
                          {t?.methods[0]?.label ?? "Method"}
                        </p>
                        <StatusBadge tone={pillTone(r.status)}>{r.status}</StatusBadge>
                      </div>
                      <p className="mt-0.5 text-[15px] font-extrabold text-forest-950">{h.name}</p>
                      <p className="text-2xl font-black text-forest-800">{h.detail}</p>
                      <hr className="my-2 border-forest-100" />
                      {r.status === "REVIEW REQUIRED" && (
                        <div className="mb-2">{reviewHint(r, "prsl")}</div>
                      )}
                      <p className="text-xs text-forest-900/60">{t?.shortSummary}</p>
                      <button onClick={() => setShowMethod((v) => !v)} className="mt-1 text-xs font-bold text-forest-600">
                        {showMethod ? "Hide method ▲" : "Tap for method ▼"}
                      </button>
                      {showMethod && (
                        <div className="mt-2 text-xs leading-relaxed text-forest-900/75">
                          <p>{t?.expandedSummary}</p>
                          <p className="mt-1">Breakdown: {Object.entries(r.result ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</p>
                          {r.criterionSnapshot && (
                            <p className="mt-1">
                              Criterion {r.criterionSnapshot.operator} {r.criterionSnapshot.value} {r.criterionSnapshot.unit}
                              {r.rslProfile ? ` · ${r.rslProfile.key} v${r.rslProfile.version}` : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => togglePublish(r)} className="btn-secondary !py-1.5 text-xs">
                        {r.published ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => delResult(r)} className="btn-secondary !py-1.5 text-xs !text-red-700">Delete</button>
                    </div>
                  </CollapsibleSection>
                );
              })}
              {physical.length === 0 && <p className="text-sm text-forest-900/60">No test results yet — pick a test in the form below.</p>}
            </div>
            <form id="qform-physical" onSubmit={addPhysical} className="mt-4 space-y-3 rounded-xl bg-forest-50/60 p-4 ring-1 ring-forest-100">
              <div>
                <label className="label" htmlFor="tq">Select Test</label>
                <input id="tq" className="input" placeholder="Search 12 tests…" value={testQ} onChange={(e) => setTestQ(e.target.value)} />
                <div className="mt-1.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                  {testMatches.map((t) => (
                    <button type="button" key={t.testId}
                      onClick={() => { setTestId(t.testId); setPVals({}); setPMethod(t.methods[0]?.methodId ?? ""); }}
                      className={`badge cursor-pointer ring-1 ${testId === t.testId ? "bg-forest-700 text-white ring-forest-700" : "bg-white text-forest-800 ring-forest-200"}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
                {selTest && <p className="mt-1.5 text-xs text-forest-900/60">{selTest.methods[0]?.label} · {selTest.shortSummary}</p>}
              </div>
              {selTest && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {selTest.resultSchema.map((f) => (
                    <div key={f.key}>
                      <label className="label" htmlFor={`pf-${f.key}`}>{f.label}{f.required ? " *" : ""}</label>
                      {f.type === "grade" ? (
                        <select id={`pf-${f.key}`} className="input" value={pVals[f.key] ?? ""}
                          onChange={(e) => setPVals({ ...pVals, [f.key]: e.target.value })} required={f.required}>
                          <option value="">Select…</option>
                          {(f.scale === "blue_wool_1_8" ? BLUE_WOOL : GREY_GRADES).map((g) => (
                            <option key={g}>{g}</option>
                          ))}
                        </select>
                      ) : f.type === "enum" ? (
                        <select id={`pf-${f.key}`} className="input" value={pVals[f.key] ?? ""}
                          onChange={(e) => setPVals({ ...pVals, [f.key]: e.target.value })} required={f.required}>
                          <option value="">Select…</option>
                          {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input id={`pf-${f.key}`} className="input" inputMode={f.type === "number" ? "decimal" : undefined}
                          value={pVals[f.key] ?? ""} onChange={(e) => setPVals({ ...pVals, [f.key]: e.target.value })}
                          required={f.required} />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selTest?.resultSchema.some((f) => f.scale === "grey_scale_1_5") && (
                <p className="text-xs text-forest-900/60">
                  Grade aid: {GREY_AID.map(([g, m]) => `${g} ${m}`).join(" · ")}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="prsl">RSL profile</label>
                  <select id="prsl" className="input" value={pRsl} onChange={(e) => setPRsl(e.target.value)}>
                    <option value="">No profile — saved without a verdict</option>
                    {rsls.map((r) => (
                      <option key={r.key + r.version} value={JSON.stringify({ key: r.key, version: r.version })}>
                        {r.key} v{r.version}{r.buyerProgram ? ` · ${r.buyerProgram}` : ""}
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    Verdict comes from this profile&apos;s test criteria — key and unit must match your
                    entry. Choose it before saving: saved results are never re-evaluated.{" "}
                    <HelpLink anchor="help-verdicts" label="Why verdicts show REVIEW REQUIRED" />
                  </FieldHint>
                </div>
                <div>
                  <label className="label" htmlFor="prep">Lab report</label>
                  <select id="prep" className="input" value={pReport} onChange={(e) => setPReport(e.target.value)}>
                    <option value="">None</option>
                    {reports.map((r) => <option key={r._id} value={r._id}>{r.labName} · {r.reportNumber}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="pdate">Test date</label>
                  <input id="pdate" type="date" className="input" value={pDate} onChange={(e) => setPDate(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="pcomp">Component scope</label>
                  <input id="pcomp" className="input" value={pComp} onChange={(e) => setPComp(e.target.value)} placeholder="e.g. Main fabric" />
                </div>
              </div>
              <button className="btn-primary !py-2.5 text-xs" type="submit">Save test result</button>
              {msg && msgFor === "physical" && (
                <p className="mt-2 rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>
              )}
            </form>
          </CollapsibleSection>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-forest-100 pt-3">
            {secMsg && <p className="mr-auto text-sm font-semibold text-forest-800">{secMsg}</p>}
            <button onClick={saveSection} className="btn-primary !py-2 text-xs">
              Save Section
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
