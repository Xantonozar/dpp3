"use client";

import { useEffect, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { SEASON_OPTIONS, GENDER_OPTIONS } from "@/lib/validators/product";

export type ProductOverviewData = {
  _id?: string;
  productId: string;
  name?: string;
  styleNo?: string;
  brand?: string;
  season?: string;
  gender?: string;
  productType?: string;
  buyerBrand?: string;
  status?: string;
};

export function ProductOverviewCard({
  productId,
  initialProduct,
  onUpdate,
}: {
  productId: string;
  initialProduct?: ProductOverviewData | null;
  onUpdate?: (updated: ProductOverviewData) => void;
}) {
  const [form, setForm] = useState({
    name: initialProduct?.name ?? "",
    styleNo: initialProduct?.styleNo ?? "",
    brand: initialProduct?.brand ?? "",
    season: initialProduct?.season ?? "",
    gender: initialProduct?.gender ?? "",
    productType: initialProduct?.productType ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (initialProduct) {
      setForm({
        name: initialProduct.name ?? "",
        styleNo: initialProduct.styleNo ?? "",
        brand: initialProduct.brand ?? "",
        season: initialProduct.season ?? "",
        gender: initialProduct.gender ?? "",
        productType: initialProduct.productType ?? "",
      });
    }
  }, [initialProduct]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          styleNo: form.styleNo.trim() || undefined,
          brand: form.brand.trim() || undefined,
          season: form.season || undefined,
          gender: form.gender || undefined,
          productType: form.productType.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save product overview.");
      }
      setMsg("Product overview saved successfully.");
      onUpdate?.(body.data);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("product:updated", { detail: body.data }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const summary = [form.brand, form.season, form.gender]
    .filter(Boolean)
    .join(" · ") || "Brand name, Season & Gender specifications";

  return (
    <div id="sec-overview" className="scroll-mt-32">
      <CollapsibleSection
        id="overview"
        level={1}
        title="Product Overview"
        summary={summary}
        defaultOpen
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="ov-brand">
                Brand name <span className="text-forest-600 font-bold">*</span>
              </label>
              <input
                id="ov-brand"
                className="input"
                placeholder="e.g. EcoWear / Brand Name"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-forest-900/60">
                Primary buyer brand or label
              </p>
            </div>

            <div>
              <label className="label" htmlFor="ov-season">
                Season <span className="text-forest-600 font-bold">*</span>
              </label>
              <select
                id="ov-season"
                className="input"
                value={form.season}
                onChange={(e) => setForm({ ...form, season: e.target.value })}
              >
                <option value="">Select season…</option>
                {SEASON_OPTIONS.map((opt, i) => (
                  <option key={opt} value={opt}>
                    {i + 1}. {opt}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-forest-900/60">
                Collection season (Spring/Summer, Autumn/Winter, etc.)
              </p>
            </div>

            <div>
              <label className="label" htmlFor="ov-gender">
                Gender <span className="text-forest-600 font-bold">*</span>
              </label>
              <select
                id="ov-gender"
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Select gender…</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-forest-900/60">
                Target demographic (Boys, Girls, Mens, Womens, Unisex, etc.)
              </p>
            </div>

            <div>
              <label className="label" htmlFor="ov-name">
                Product Name
              </label>
              <input
                id="ov-name"
                className="input"
                placeholder="e.g. Organic Cotton Tee"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="ov-styleNo">
                Style no.
              </label>
              <input
                id="ov-styleNo"
                className="input"
                placeholder="e.g. SS26-01"
                value={form.styleNo}
                onChange={(e) => setForm({ ...form, styleNo: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="ov-productType">
                Product type
              </label>
              <input
                id="ov-productType"
                className="input"
                placeholder="e.g. T-Shirt / Hoodie"
                value={form.productType}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-forest-100 pt-3">
            <div className="min-w-0 flex-1">
              {msg && (
                <p className="text-xs font-bold text-forest-800">
                  ✓ {msg}
                </p>
              )}
              {err && (
                <p role="alert" className="text-xs font-bold text-red-700">
                  {err}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary !py-2 text-xs"
            >
              {saving ? "Saving…" : "Save Overview"}
            </button>
          </div>
        </form>
      </CollapsibleSection>
    </div>
  );
}
