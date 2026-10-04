"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SetupChecklist } from "@/components/SetupChecklist";
import { TakeTourButton } from "@/components/TakeTourButton";
import { HelpLink } from "@/components/ui/HelpLink";

type Product = {
  _id: string;
  productId: string;
  name?: string;
  styleNo?: string;
  status: string;
  colors?: { name: string }[];
  updatedAt: string;
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ productId: "", name: "", styleNo: "" });

  async function load() {
    setBusy(true);
    setLoadErr("");
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    try {
      const res = await fetch(`/api/products?${p}`);
      const body = await res.json();
      setItems(body.data ?? []);
      if (!res.ok) setLoadErr(body.error ?? `Failed to load (HTTP ${res.status}).`);
    } catch {
      setLoadErr("Couldn't reach the server — it may still be starting up. Retry in a moment.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    if (!res.ok) {
      setMsg(body.error ?? "Create failed");
      return;
    }
    setShowCreate(false);
    setForm({ productId: "", name: "", styleNo: "" });
    load();
  }

  async function remove(id: string, productId: string) {
    if (!window.confirm(`Delete product ${productId}? This removes its variants too.`)) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setMsg(body.error ?? "Delete failed");
      return;
    }
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-tour="page-header">
          <h1 className="text-2xl font-black tracking-tight text-forest-950">
            Products
          </h1>
          <p className="text-sm text-forest-900/60">
            Create a product, then open Variants to add colors, sizes & GTINs.{" "}
            <HelpLink anchor="help-workflow" label="How the workflow works" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TakeTourButton />
          <button data-tour="new-product" onClick={() => setShowCreate((v) => !v)} className="btn-primary">
            + New product
          </button>
        </div>
      </div>

      <SetupChecklist />

      {showCreate && (
        <form onSubmit={create} className="card space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="pid">Product ID *</label>
              <input id="pid" className="input" value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                placeholder="TSH-001" required />
            </div>
            <div>
              <label className="label" htmlFor="pname">Name</label>
              <input id="pname" className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Organic Tee" />
            </div>
            <div>
              <label className="label" htmlFor="pstyle">Style no.</label>
              <input id="pstyle" className="input" value={form.styleNo}
                onChange={(e) => setForm({ ...form, styleNo: e.target.value })}
                placeholder="SS26-01" />
            </div>
          </div>
          {msg && <p role="alert" className="text-sm font-semibold text-red-700">{msg}</p>}
          <button className="btn-primary" type="submit">Create product</button>
        </form>
      )}

      <div data-tour="search" className="flex flex-wrap gap-2">
        <input className="input !w-64" placeholder="Search ID, name, style…"
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()} />
        <select className="input !w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          <option>Draft</option>
          <option>Published</option>
          <option>Archived</option>
        </select>
        <button onClick={load} className="btn-secondary">{busy ? "Loading…" : "Search"}</button>
      </div>

      <div className="grid gap-3">
        {loadErr && !busy && (
          <div className="card p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-red-700">{loadErr}</p>
            <button onClick={load} className="btn-secondary mt-3 !py-2 text-xs">Retry</button>
          </div>
        )}
        {items.map((p) => (
          <div key={p._id} data-tour="product-card" className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold text-forest-950">
                {p.name || p.productId}
                <span className="ml-2 font-mono text-xs font-semibold text-forest-900/50">{p.productId}</span>
              </p>
              <p className="text-xs text-forest-900/60">
                {p.colors?.length ?? 0} colors · {p.status} · {p.styleNo ?? "no style"}
              </p>
            </div>
            <span className="badge bg-forest-100 text-forest-800">{p.status}</span>
            <Link href={`/products/${p._id}`} className="btn-primary !py-2 text-xs">
              Open →
            </Link>
            <button onClick={() => remove(p._id, p.productId)} className="btn-secondary !py-2 text-xs">
              Delete
            </button>
          </div>
        ))}
        {items.length === 0 && !busy && !loadErr && (
          <div className="card p-8 text-center text-sm text-forest-900/60">
            No products yet — create the first one above.
          </div>
        )}
      </div>
    </div>
  );
}
