"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiErrorMessage } from "@/lib/apiError";

const FIELD_LABELS: Record<string, string> = {
  catalogId: "Standard",
  recordType: "Record type",
  category: "Category",
  applicableTo: "Applicable to",
  tierStage: "Tier / stage",
  relatedEntityId: "Facility",
  batchId: "Batch",
  scopeText: "Scope",
  documentNumber: "Certificate ID",
  issuer: "Issuer",
  issueDate: "Issue date",
  expiryDate: "Expiry date",
  assessmentDate: "Assessment date",
  reviewDate: "Review date",
  status: "Status",
  complianceOutcome: "Compliance outcome",
  requirementName: "Requirement name",
  evidenceType: "Evidence type",
  evidenceUrl: "Evidence URL",
  details: "Record-type details",
};

type Std = { catalogId: string; displayName?: string; officialName?: string; defaultRecordType?: string; defaultCategory?: string; active?: boolean };
type Fac = { _id: string; name: string; location: string; kind?: string };
type Rec = {
  _id: string; catalogId: string; recordType: string; category?: string; applicableTo?: string;
  tierStage?: string; relatedEntityId?: string; scopeText: string; documentNumber?: string;
  issuer?: string; issueDate?: string; expiryDate?: string; noStatedExpiry?: boolean;
  assessmentDate?: string; reviewDate?: string; status: string; notApplicableReason?: string;
  rejectionReason?: string; complianceOutcome?: string; requirementName?: string;
  requirementLimit?: string; evidenceType?: string; evidenceUrl?: string;
  publicEvidenceApproved?: boolean; verificationMethod?: string; remarks?: string;
  batchId?: string; archivedAt?: string;
  details?: {
    audit?: { auditReference?: string; auditResult?: string; findings?: string; remediation?: string; followUpDate?: string };
    programme?: { participationId?: string };
    legal?: { authority?: string; permitNumber?: string; effectiveDate?: string };
    productTest?: { testMethod?: string; sampleRef?: string; labName?: string; resultValue?: string; resultUnit?: string; reportNumber?: string; reportDate?: string };
  };
};

const RECORD_TYPES = ["Certification", "Audit/Assessment", "Programme", "Management System", "Legal/Statutory", "Product Test/Requirement"];
const STATUSES = ["Verified", "Not Assessed", "Not Applicable", "Rejected/Invalid"];
const OUTCOMES = ["Not assessed", "Compliant", "Non-compliant", "Not applicable"];

const blankForm = (): Record<string, string | boolean> => ({
  catalogId: "", recordType: "Certification", category: "", applicableTo: "", tierStage: "",
  facilityId: "", linkProduct: true, batchId: "", scopeText: "", documentNumber: "",
  issuer: "", issueDate: "", expiryDate: "", noStatedExpiry: false, assessmentDate: "",
  reviewDate: "", status: "Verified", notApplicableReason: "", rejectionReason: "",
  complianceOutcome: "Not assessed", requirementName: "", requirementLimit: "",
  evidenceType: "", evidenceUrl: "", publicEvidenceApproved: false,
  verificationMethod: "", remarks: "",
  auditReference: "", auditResult: "", findings: "", remediation: "", followUpDate: "",
  participationId: "", legalAuthority: "", permitNumber: "", effectiveDate: "",
  testMethod: "", sampleRef: "", labName: "", resultValue: "", resultUnit: "",
  reportNumber: "", reportDate: "",
});

function tone(s: string) {
  if (s === "Verified" || s === "Compliant") return "ok";
  if (s === "Rejected/Invalid" || s === "Non-compliant") return "error";
  if (s === "Not Applicable" || s === "Not applicable") return "neutral";
  return "warn";
}

export function CertificationSection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [stds, setStds] = useState<Std[]>([]);
  const [records, setRecords] = useState<Rec[]>([]);
  const [counters, setCounters] = useState<{ certification: Record<string, number>; compliance: Record<string, number> } | null>(null);
  const [lists, setLists] = useState<Record<string, { code: string; label: string }[]>>({});
  const [fQ, setFQ] = useState("");
  const [facilities, setFacilities] = useState<Fac[]>([]);
  const [form, setForm] = useState(blankForm());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [evFile, setEvFile] = useState<{ publicId: string; secureUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fTier, setFTier] = useState("");
  const [fStd, setFStd] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [warns, setWarns] = useState<string[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [cat, rec, ...ls] = await Promise.all([
      fetch("/api/certifications/catalog").then((r) => r.json()),
      fetch(`/api/certifications?productId=${pid}`).then((r) => r.json()),
      ...["category", "applicable_to", "tier_stage", "evidence_type", "verification_method"].map((l) =>
        fetch(`/api/catalogs/${l}`).then((r) => r.json())
      ),
    ]);
    setStds((cat.data ?? []).filter((s: Std) => s.active !== false));
    setRecords(rec.data ?? []);
    setCounters(rec.counters ?? null);
    const labels = ["category", "applicable_to", "tier_stage", "evidence_type", "verification_method"];
    const next: Record<string, { code: string; label: string }[]> = {};
    ls.forEach((b, i) => {
      next[labels[i]] = (b.data ?? []).filter((o: { active?: boolean }) => o.active !== false);
    });
    setLists(next);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (id) load(id).catch((e) => {
      setErr(e instanceof Error ? e.message : "Load failed");
      setBusy(false);
    });
  }, [id, load]);

  useEffect(() => {
    if (!fQ.trim()) {
      setFacilities([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/facilities?q=${encodeURIComponent(fQ.trim())}`)
        .then((r) => r.json())
        .then((b) => setFacilities(b.data ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [fQ]);

  const stdName = useCallback((cid: string) => stds.find((s) => s.catalogId === cid)?.displayName ?? cid, [stds]);
  const facName = useCallback((fid?: string) => {
    const f = facilities.find((x) => x._id === fid);
    return f ? `${f.name} — ${f.location}` : fid ?? "";
  }, [facilities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (fTier && r.tierStage !== fTier) return false;
      if (fStd && r.catalogId !== fStd) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (q && !(r.scopeText + " " + (r.requirementName ?? "") + " " + (r.documentNumber ?? "")).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, fTier, fStd, fStatus, query]);
  const certs = filtered.filter((r) => r.recordType === "Certification");
  const others = filtered.filter((r) => r.recordType !== "Certification");

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pickStandard(catalogId: string) {
    const s = stds.find((x) => x.catalogId === catalogId);
    setForm((f) => ({
      ...f,
      catalogId,
      recordType: s?.defaultRecordType ?? f.recordType,
      category: s?.defaultCategory ?? f.category,
    }));
  }

  function startAdd() {
    setForm(blankForm());
    setEvFile(null);
    setEditing(null);
    setShowForm(true);
    setWarns([]);
  }

  function startEdit(r: Rec) {
    const d = r.details ?? {};
    setForm({
      ...blankForm(),
      catalogId: r.catalogId, recordType: r.recordType, category: r.category ?? "",
      applicableTo: r.applicableTo ?? "", tierStage: r.tierStage ?? "",
      facilityId: r.relatedEntityId ?? "", linkProduct: true, batchId: r.batchId ?? "",
      scopeText: r.scopeText, documentNumber: r.documentNumber ?? "", issuer: r.issuer ?? "",
      issueDate: r.issueDate?.slice(0, 10) ?? "", expiryDate: r.expiryDate?.slice(0, 10) ?? "",
      noStatedExpiry: r.noStatedExpiry ?? false, assessmentDate: r.assessmentDate?.slice(0, 10) ?? "",
      reviewDate: r.reviewDate?.slice(0, 10) ?? "", status: r.status,
      notApplicableReason: r.notApplicableReason ?? "", rejectionReason: r.rejectionReason ?? "",
      complianceOutcome: r.complianceOutcome ?? "Not assessed",
      requirementName: r.requirementName ?? "", requirementLimit: r.requirementLimit ?? "",
      evidenceType: r.evidenceType ?? "", evidenceUrl: r.evidenceUrl ?? "",
      publicEvidenceApproved: r.publicEvidenceApproved ?? false,
      verificationMethod: r.verificationMethod ?? "", remarks: r.remarks ?? "",
      auditReference: d.audit?.auditReference ?? "", auditResult: d.audit?.auditResult ?? "",
      findings: d.audit?.findings ?? "", remediation: d.audit?.remediation ?? "",
      followUpDate: d.audit?.followUpDate?.slice(0, 10) ?? "",
      participationId: d.programme?.participationId ?? "",
      legalAuthority: d.legal?.authority ?? "", permitNumber: d.legal?.permitNumber ?? "",
      effectiveDate: d.legal?.effectiveDate?.slice(0, 10) ?? "",
      testMethod: d.productTest?.testMethod ?? "", sampleRef: d.productTest?.sampleRef ?? "",
      labName: d.productTest?.labName ?? "", resultValue: d.productTest?.resultValue ?? "",
      resultUnit: d.productTest?.resultUnit ?? "", reportNumber: d.productTest?.reportNumber ?? "",
      reportDate: d.productTest?.reportDate?.slice(0, 10) ?? "",
    });
    setEvFile(null);
    setEditing(r._id);
    setShowForm(true);
    setWarns([]);
  }

  async function uploadEvidence(file: File) {
    if (file.size > 15_000_000) {
      setErr("Evidence too large (max 15 MB).");
      return;
    }
    setUploading(true);
    try {
      const sign = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "cert_evidence", productId: id }),
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
      setEvFile({ publicId: data.public_id, secureUrl: data.secure_url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function payload() {
    return {
      catalogId: form.catalogId,
      recordType: form.recordType,
      category: form.category || undefined,
      applicableTo: form.applicableTo || undefined,
      tierStage: form.tierStage || undefined,
      relatedEntityId: form.facilityId || undefined,
      linkProduct: form.linkProduct,
      batchId: form.batchId || undefined,
      scopeText: form.scopeText,
      documentNumber: form.documentNumber || undefined,
      issuer: form.issuer || undefined,
      issueDate: form.issueDate || undefined,
      expiryDate: form.expiryDate || undefined,
      noStatedExpiry: form.noStatedExpiry,
      assessmentDate: form.assessmentDate || undefined,
      reviewDate: form.reviewDate || undefined,
      status: form.status,
      notApplicableReason: form.notApplicableReason || undefined,
      rejectionReason: form.rejectionReason || undefined,
      complianceOutcome: form.complianceOutcome || undefined,
      requirementName: form.requirementName || undefined,
      requirementLimit: form.requirementLimit || undefined,
      evidenceType: form.evidenceType || undefined,
      evidenceFile: evFile ?? undefined,
      evidenceUrl: form.evidenceUrl || undefined,
      publicEvidenceApproved: form.publicEvidenceApproved,
      verificationMethod: form.verificationMethod || undefined,
      remarks: form.remarks || undefined,
      details: {
        audit: { auditReference: form.auditReference || undefined, auditResult: form.auditResult || undefined, findings: form.findings || undefined, remediation: form.remediation || undefined, followUpDate: form.followUpDate || undefined },
        programme: { participationId: form.participationId || undefined },
        legal: { authority: form.legalAuthority || undefined, permitNumber: form.permitNumber || undefined, effectiveDate: form.effectiveDate || undefined },
        productTest: { testMethod: form.testMethod || undefined, sampleRef: form.sampleRef || undefined, labName: form.labName || undefined, resultValue: form.resultValue || undefined, resultUnit: form.resultUnit || undefined, reportNumber: form.reportNumber || undefined, reportDate: form.reportDate || undefined },
      },
    };
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setWarns([]);
    setErr("");
    try {
      const url = editing ? `/api/certifications/${editing}` : `/api/certifications?productId=${id}`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(body, FIELD_LABELS));
      setWarns(body.warnings ?? []);
      setMsg(editing ? "Record updated." : "Record saved — counters refreshed.");
      setShowForm(false);
      setEditing(null);
      await load(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function archive(r: Rec) {
    if (!window.confirm(`Archive “${stdName(r.catalogId)}”? History is kept; counters will exclude it.`)) return;
    await fetch(`/api/certifications/${r._id}`, { method: "DELETE" });
    load(id);
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading certification…</div>;
  const rt = String(form.recordType);

  const row = (r: Rec) => (
    <CollapsibleSection key={r._id} id={`cert-${r._id}`} level={3}
      title={`${stdName(r.catalogId)} · ${r.recordType}`} summary={`${r.status} · ${r.assessmentDate?.slice(0, 10) ?? r.issueDate?.slice(0, 10) ?? "no date"}`}>
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div><dt className="label !mb-0">Scope</dt><dd className="text-forest-950">{r.scopeText}</dd></div>
        <div><dt className="label !mb-0">Status</dt><dd><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>{" "}
          {r.complianceOutcome && <StatusBadge tone={tone(r.complianceOutcome)}>{r.complianceOutcome}</StatusBadge>}</dd></div>
        {r.issuer && <div><dt className="label !mb-0">Issuer</dt><dd>{r.issuer}</dd></div>}
        {r.documentNumber && <div><dt className="label !mb-0">Certificate ID</dt><dd className="font-mono">{r.documentNumber}</dd></div>}
        {r.tierStage && <div><dt className="label !mb-0">Tier / stage</dt><dd>{r.tierStage}</dd></div>}
        {r.relatedEntityId && <div><dt className="label !mb-0">Facility</dt><dd>{facName(r.relatedEntityId)}</dd></div>}
        {r.requirementName && <div><dt className="label !mb-0">Requirement</dt><dd>{r.requirementName}{r.requirementLimit ? ` (${r.requirementLimit})` : ""}</dd></div>}
        {(r.issueDate || r.expiryDate) && <div><dt className="label !mb-0">Validity</dt><dd>{r.issueDate?.slice(0, 10) ?? "—"} → {r.noStatedExpiry ? "no stated expiry" : (r.expiryDate?.slice(0, 10) ?? "—")}</dd></div>}
        {r.evidenceType && <div><dt className="label !mb-0">Evidence</dt><dd>{r.evidenceType}{r.publicEvidenceApproved ? " · approved for public" : " · private"}</dd></div>}
        {r.verificationMethod && <div><dt className="label !mb-0">Verified by</dt><dd>{r.verificationMethod}</dd></div>}
      </dl>
      <div className="mt-2 flex gap-2">
        <button onClick={() => startEdit(r)} className="btn-secondary !py-1.5 text-xs">Edit</button>
        <button onClick={() => archive(r)} className="btn-secondary !py-1.5 text-xs !text-red-700">Archive</button>
      </div>
    </CollapsibleSection>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <a href={`/api/certifications/report?productId=${id}`} className="btn-secondary !py-2 text-xs">Download Report</a>
        <button onClick={startAdd} className="btn-primary !py-2 text-xs">+ Add New</button>
      </div>
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {warns.map((w, i) => (
        <p key={i} className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">⚠ {w}</p>
      ))}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <CollapsibleSection id="certification" level={1} help={() => startTour("certification", "certification")} title="7. Certification & Compliance"
        summary={`${records.length} record(s)`} defaultOpen>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <CollapsibleSection id="cert-overview" level={2} help={() => startTour("certification", "cert-overview")} title="7.1 Certification Overview" defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {counters && Object.entries(counters.certification).map(([k, v]) => (
                  <span key={k} className="badge bg-forest-100 text-forest-800">{k}: {v}</span>
                ))}
              </div>
            </CollapsibleSection>
            <CollapsibleSection id="comp-overview" level={2} help={() => startTour("certification", "comp-overview")} title="7.2 Compliance Overview" defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {counters && Object.entries(counters.compliance).map(([k, v]) => (
                  <span key={k} className="badge bg-forest-100 text-forest-800">{k}: {v}</span>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          <div className="flex flex-wrap gap-2">
            <input className="input !w-52" placeholder="Search scope, requirement, ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="input !w-40" value={fTier} onChange={(e) => setFTier(e.target.value)} aria-label="Filter by tier">
              <option value="">All tiers</option>
              {[...new Set(records.map((r) => r.tierStage).filter(Boolean))].map((t) => <option key={t as string} value={t as string}>{t as string}</option>)}
            </select>
            <select className="input !w-44" value={fStd} onChange={(e) => setFStd(e.target.value)} aria-label="Filter by standard">
              <option value="">All standards</option>
              {stds.map((s) => <option key={s.catalogId} value={s.catalogId}>{s.displayName}</option>)}
            </select>
            <select className="input !w-40" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <CollapsibleSection id="cert-records" level={2} help={() => startTour("certification", "cert-records")} title="7.3 Certification Records" summary={`${certs.length} record(s)`} defaultOpen>
            <div className="space-y-2">
              {certs.map(row)}
              {certs.length === 0 && <p className="text-sm text-forest-900/60">No certification records yet — press “+ Add New” above.</p>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="audit-records" level={2} help={() => startTour("certification", "audit-records")} title="7.4 Audit / Programme / Compliance Records" summary={`${others.length} record(s)`}>
            <div className="space-y-2">
              {others.map(row)}
              {others.length === 0 && <p className="text-sm text-forest-900/60">No audit, programme or compliance records yet — press “+ Add New” above.</p>}
            </div>
          </CollapsibleSection>

          {showForm && (
            <div className="card space-y-3 p-5">
              <p className="text-sm font-extrabold text-forest-950">{editing ? "Edit record" : "Add New"}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-std">Standard *</label>
                  <select id="c-std" className="input" value={String(form.catalogId)} onChange={(e) => pickStandard(e.target.value)}>
                    <option value="">Search & select…</option>
                    {stds.map((s) => <option key={s.catalogId} value={s.catalogId}>{s.displayName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-rt">Record type *</label>
                  <select id="c-rt" className="input" value={String(form.recordType)} onChange={(e) => set("recordType", e.target.value)}>
                    {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-cat">Category</label>
                  <select id="c-cat" className="input" value={String(form.category)} onChange={(e) => set("category", e.target.value)}>
                    <option value="">Select…</option>
                    {(lists.category ?? []).map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-app">Applicable to</label>
                  <select id="c-app" className="input" value={String(form.applicableTo)} onChange={(e) => set("applicableTo", e.target.value)}>
                    <option value="">Select…</option>
                    {(lists.applicable_to ?? []).map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-tier">Tier / stage</label>
                  <select id="c-tier" className="input" value={String(form.tierStage)} onChange={(e) => set("tierStage", e.target.value)}>
                    <option value="">Select…</option>
                    {(lists.tier_stage ?? []).map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-fac">Related facility / supplier</label>
                  <input id="c-fac" className="input" placeholder="Type to search facilities…" value={fQ} onChange={(e) => setFQ(e.target.value)} />
                  {facilities.length > 0 && (
                    <div className="mt-1 max-h-32 overflow-y-auto rounded-xl ring-1 ring-forest-100">
                      {facilities.map((f) => (
                        <button type="button" key={f._id} onClick={() => { set("facilityId", f._id); setFQ(`${f.name} — ${f.location}`); setFacilities([]); }}
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-forest-50">
                          {f.name} — {f.location}{f.kind ? ` (${f.kind})` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="c-scope">Scope * (always shown, incl. facility certificates)</label>
                  <textarea id="c-scope" className="input min-h-20" rows={3} value={String(form.scopeText)} onChange={(e) => set("scopeText", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="c-doc">Certificate / document ID</label>
                  <input id="c-doc" className="input font-mono" value={String(form.documentNumber)} onChange={(e) => set("documentNumber", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="c-iss">Issuer</label>
                  <input id="c-iss" className="input" value={String(form.issuer)} onChange={(e) => set("issuer", e.target.value)} placeholder="Fairtrade: exact scheme name" />
                </div>
                <div>
                  <label className="label" htmlFor="c-issue">Issue date</label>
                  <input id="c-issue" type="date" className="input" value={String(form.issueDate)} onChange={(e) => set("issueDate", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="c-exp">Expiry date (display only — never changes status)</label>
                  <input id="c-exp" type="date" className="input" value={String(form.expiryDate)} onChange={(e) => set("expiryDate", e.target.value)} />
                  <label className="mt-1 flex items-center gap-2 text-xs font-semibold text-forest-900/70">
                    <input type="checkbox" checked={!!form.noStatedExpiry} onChange={(e) => set("noStatedExpiry", e.target.checked)} className="accent-green-700" />
                    No stated expiry
                  </label>
                </div>
                <div>
                  <label className="label" htmlFor="c-status">Status</label>
                  <select id="c-status" className="input" value={String(form.status)} onChange={(e) => set("status", e.target.value)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-out">Compliance outcome</label>
                  <select id="c-out" className="input" value={String(form.complianceOutcome)} onChange={(e) => set("complianceOutcome", e.target.value)}>
                    {OUTCOMES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {(form.status === "Not Applicable" || form.complianceOutcome === "Not applicable") && (
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="c-na">Reason (required for N/A) *</label>
                    <input id="c-na" className="input" value={String(form.notApplicableReason)} onChange={(e) => set("notApplicableReason", e.target.value)} />
                  </div>
                )}
                {(form.complianceOutcome === "Compliant" || form.complianceOutcome === "Non-compliant") && (
                  <>
                    <div>
                      <label className="label" htmlFor="c-req">Exact requirement name *</label>
                      <input id="c-req" className="input" value={String(form.requirementName)} onChange={(e) => set("requirementName", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-lim">Requirement limit</label>
                      <input id="c-lim" className="input" value={String(form.requirementLimit)} onChange={(e) => set("requirementLimit", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-ass">Assessment date *</label>
                      <input id="c-ass" type="date" className="input" value={String(form.assessmentDate)} onChange={(e) => set("assessmentDate", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-rev">Review date</label>
                      <input id="c-rev" type="date" className="input" value={String(form.reviewDate)} onChange={(e) => set("reviewDate", e.target.value)} />
                    </div>
                  </>
                )}
                {rt === "Audit/Assessment" && (
                  <>
                    <div>
                      <label className="label" htmlFor="c-aref">Audit reference *</label>
                      <input id="c-aref" className="input" value={String(form.auditReference)} onChange={(e) => set("auditReference", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-ares">Audit result (if shareable)</label>
                      <input id="c-ares" className="input" value={String(form.auditResult)} onChange={(e) => set("auditResult", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-find">Findings (private)</label>
                      <textarea id="c-find" className="input" rows={2} value={String(form.findings)} onChange={(e) => set("findings", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-rem">Remediation (private)</label>
                      <textarea id="c-rem" className="input" rows={2} value={String(form.remediation)} onChange={(e) => set("remediation", e.target.value)} />
                    </div>
                  </>
                )}
                {rt === "Programme" && (
                  <div>
                    <label className="label" htmlFor="c-part">Participation / site ID *</label>
                    <input id="c-part" className="input" value={String(form.participationId)} onChange={(e) => set("participationId", e.target.value)} />
                  </div>
                )}
                {rt === "Legal/Statutory" && (
                  <>
                    <div>
                      <label className="label" htmlFor="c-auth">Authority *</label>
                      <input id="c-auth" className="input" value={String(form.legalAuthority)} onChange={(e) => set("legalAuthority", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-permit">Permit number *</label>
                      <input id="c-permit" className="input" value={String(form.permitNumber)} onChange={(e) => set("permitNumber", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-eff">Effective date *</label>
                      <input id="c-eff" type="date" className="input" value={String(form.effectiveDate)} onChange={(e) => set("effectiveDate", e.target.value)} />
                    </div>
                  </>
                )}
                {rt === "Product Test/Requirement" && (
                  <>
                    <div>
                      <label className="label" htmlFor="c-tm">Test method *</label>
                      <input id="c-tm" className="input" value={String(form.testMethod)} onChange={(e) => set("testMethod", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-lab">Lab name *</label>
                      <input id="c-lab" className="input" value={String(form.labName)} onChange={(e) => set("labName", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-rn">Report number *</label>
                      <input id="c-rn" className="input" value={String(form.reportNumber)} onChange={(e) => set("reportNumber", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor="c-rv">Result value</label>
                        <input id="c-rv" className="input" value={String(form.resultValue)} onChange={(e) => set("resultValue", e.target.value)} />
                      </div>
                      <div>
                        <label className="label" htmlFor="c-ru">Result unit</label>
                        <input id="c-ru" className="input" value={String(form.resultUnit)} onChange={(e) => set("resultUnit", e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="label" htmlFor="c-et">Evidence type</label>
                  <select id="c-et" className="input" value={String(form.evidenceType)} onChange={(e) => set("evidenceType", e.target.value)}>
                    <option value="">Select…</option>
                    {(lists.evidence_type ?? []).map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-ev">Evidence file (private) / URL</label>
                  <input id="c-ev" type="file" accept=".pdf,.jpg,.jpeg,.png" className="input"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEvidence(f); e.target.value = ""; }} />
                  {uploading && <p className="text-xs">Uploading…</p>}
                  {evFile && <p className="text-xs font-semibold text-forest-700">✓ {evFile.publicId}</p>}
                  <input className="input mt-1" placeholder="…or paste official URL" value={String(form.evidenceUrl)} onChange={(e) => set("evidenceUrl", e.target.value)} />
                  <label className="mt-1 flex items-center gap-2 text-xs font-semibold text-forest-900/70">
                    <input type="checkbox" checked={!!form.publicEvidenceApproved} onChange={(e) => set("publicEvidenceApproved", e.target.checked)} className="accent-green-700" />
                    Approve evidence for public view
                  </label>
                </div>
                <div>
                  <label className="label" htmlFor="c-vm">Verification method (how the admin checked it)</label>
                  <select id="c-vm" className="input" value={String(form.verificationMethod)} onChange={(e) => set("verificationMethod", e.target.value)}>
                    <option value="">Select…</option>
                    {(lists.verification_method ?? []).map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="c-batch">Batch / material ref</label>
                  <input id="c-batch" className="input" value={String(form.batchId)} onChange={(e) => set("batchId", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="c-rem2">Remarks</label>
                  <textarea id="c-rem2" className="input" rows={2} value={String(form.remarks)} onChange={(e) => set("remarks", e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-forest-900 sm:col-span-2">
                  <input type="checkbox" checked={!!form.linkProduct} onChange={(e) => set("linkProduct", e.target.checked)} className="accent-green-700" />
                  Link to this product (uncheck for a facility-only record)
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="btn-primary !py-2 text-xs">
                  {saving ? "Saving…" : editing ? "Update record" : "Save record"}
                </button>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary !py-2 text-xs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
