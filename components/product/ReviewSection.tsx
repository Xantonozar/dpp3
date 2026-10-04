"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { HelpLink } from "@/components/ui/HelpLink";

type Check = { sector: string; saved: boolean; detail: string; missing: string[] };
type Live = { shortCode: string; version: number; publishedAt?: string };

const SECTOR_LINKS: [string, string][] = [
  ["01 Variants", "variants"],
  ["02 Materials", "materials"],
  ["03 Traceability", "traceability"],
  ["04 Quality", "quality"],
  ["05 Packaging", "packaging"],
  ["06 Environment", "environmental"],
  ["07 Certification", "certification"],
];

export function ReviewSection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [checks, setChecks] = useState<Check[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState(false);

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const res = await fetch(`/api/publish/${pid}`);
    const body = await res.json();
    if (res.ok) {
      setChecks(body.data.checks);
      setCanPublish(body.data.canPublish);
      setLive(body.data.live);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const url = live ? `${window.location.origin}/p/${live.shortCode}` : "";

  async function publish() {
    setWorking(true);
    setMsg("");
    setErr("");
    const res = await fetch(`/api/publish/${id}`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      if (body.missing) {
        setErr(`Not ready to publish yet — ${body.missing.join(" ")}`);
        setFlash(true);
        setTimeout(() => setFlash(false), 2500);
        requestAnimationFrame(() =>
          document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" })
        );
      } else {
        setErr(body.error ?? "Publish failed");
      }
    } else {
      setMsg(`Published — version ${body.data.version}. Same URL on every republish.`);
    }
    setWorking(false);
    load(id);
  }

  async function unpublish() {
    if (!window.confirm("Unpublish? The QR will show “no longer available”. You can republish anytime.")) return;
    setWorking(true);
    const res = await fetch(`/api/publish/${id}`, { method: "DELETE" });
    if (!res.ok) setErr("Unpublish failed.");
    else setMsg("Unpublished.");
    setWorking(false);
    load(id);
  }

  function copy() {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (busy) return <div className="card p-8 text-center text-sm text-forest-900/60">Loading review…</div>;

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      {live && (
        <div className="card space-y-3 p-5">
          <p className="text-sm font-extrabold text-forest-950">
            Live · version {live.version}
            <span className="badge ml-2 bg-forest-700 text-white">Public</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-forest-50 px-3 py-2 font-mono text-sm text-forest-900">{url}</code>
            <button onClick={copy} className="btn-secondary !py-2 text-xs">{copied ? "Copied ✓" : "Copy link"}</button>
            <a href={`/api/publish/${id}/qr?format=svg`} className="btn-secondary !py-2 text-xs">Download QR (SVG)</a>
            <a href={`/api/publish/${id}/qr?format=png`} className="btn-secondary !py-2 text-xs">Download QR (PNG)</a>
            <Link href={`/p/${live.shortCode}`} className="btn-secondary !py-2 text-xs">Open public page →</Link>
          </div>
          <p className="text-xs text-forest-900/60">
            Print the QR at ≥ 2 × 2 cm with a quiet zone and test-scan before printing.
            Variant links like <code className="font-mono">?v=…</code> highlight a color/size.
          </p>
        </div>
      )}

      <CollapsibleSection id="review" level={1} help={() => startTour("review", "review")} title="Publish readiness"
        summary={canPublish ? "Ready" : "Needs attention"} hasError={!canPublish} defaultOpen>
        <ul className={`space-y-2 ${flash ? "rounded-2xl ring-2 ring-red-300" : ""}`}>
          {checks.map((c, i) => {
            const link = SECTOR_LINKS[i]?.[1] ?? "";
            return (
              <li key={c.sector} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-forest-100">
                {c.saved ? <span className="size-2.5 rounded-full bg-forest-500" /> : <span className="size-2.5 rounded-full bg-red-500" />}
                <Link href={`#sec-${link}`} className="text-sm font-extrabold text-forest-950 hover:underline">
                  {c.sector}
                </Link>
                <span className="text-xs text-forest-900/60">{c.detail}</span>
                {c.missing.length > 0 && (
                  <span className="flex basis-full flex-wrap gap-1.5 pl-[1.4rem]">
                    {c.missing.map((m) => (
                      <Link key={m} href={`#sec-${link}`} className="badge bg-red-100 text-red-800 hover:underline">
                        {m}
                      </Link>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {!canPublish && (
          <p className="mt-2 text-sm font-semibold text-red-700">
            Variants (≥1) and Materials (100%) are required before publishing.{" "}
            <HelpLink anchor="help-publish" label="How publishing works" />
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-forest-100 pt-3">
          {msg && <p className="mr-auto text-sm font-semibold text-forest-800">{msg}</p>}
          {err && <p role="alert" className="mr-auto text-sm font-semibold text-red-700">{err}</p>}
          {live ? (
            <button onClick={unpublish} disabled={working} className="btn-secondary !py-2 text-xs">Unpublish</button>
          ) : (
            <button onClick={publish} disabled={working || !canPublish} className="btn-primary !py-2 text-xs">
              {working ? "Publishing…" : "Publish"}
            </button>
          )}
          {live && (
            <button onClick={publish} disabled={working} className="btn-primary !py-2 text-xs">
              Republish (v{live.version + 1})
            </button>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
