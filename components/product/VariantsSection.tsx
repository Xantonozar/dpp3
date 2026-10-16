"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { startTour } from "@/components/tour/startTour";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FieldHint } from "@/components/ui/FieldHint";
import { HelpLink } from "@/components/ui/HelpLink";
import { apiErrorMessage } from "@/lib/apiError";

const PRODUCT_LABELS: Record<string, string> = {
  styleNo: "Style no.",
  name: "Name",
  brand: "Brand name",
  season: "Season",
  gender: "Gender",
  productType: "Product type",
  buyerBrand: "Buyer",
  sizeSystemKey: "Size system",
  colors: "Colors",
  status: "Status",
};

const VARIANT_LABELS: Record<string, string> = {
  rows: "Variant rows",
  final: "Final save",
};

type SizeOpt = { key: string; label: string };
type SizeSystem = { key: string; name: string; options: SizeOpt[] };
type ColorImage = { publicId?: string; secureUrl?: string; altText?: string; sortOrder?: number };
type Color = { _id: string; name: string; colorCode?: string; images: ColorImage[]; status: string; sortOrder: number };
type Product = {
  _id: string; productId: string; name?: string; styleNo?: string;
  brand?: string; season?: string; gender?: string;
  productType?: string; buyerBrand?: string; sizeSystemKey?: string; colors: Color[];
};
type Variant = { colorId: string; sizeKey: string; gtin?: string; gtinStatus: string; active: boolean };

const MAX_COLORS = 10;
const pairKey = (c: string, s: string) => `${c}|||${s}`;

export function VariantsSection({ productId }: { productId: string }) {
  const [id] = useState(productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [systems, setSystems] = useState<SizeSystem[]>([]);
  const [pendingSystem, setPendingSystem] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [gtins, setGtins] = useState<Record<string, { gtin: string; gtinStatus: string }>>({});
  const [header, setHeader] = useState({
    name: "",
    styleNo: "",
    brand: "",
    season: "",
    gender: "",
    productType: "",
    buyerBrand: "",
  });
  const [newColorName, setNewColorName] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async (pid: string) => {
    setBusy(true);
    const [v, s] = await Promise.all([
      fetch(`/api/products/${pid}/variants`).then((r) => r.json()),
      fetch("/api/catalogs/size_systems").then((r) => r.json()),
    ]);
    const p: Product = v.data.product;
    setProduct(p);
    setSystems(s.data ?? []);
    setPendingSystem(p.sizeSystemKey ?? "");
    setHeader({
      name: p.name ?? "",
      styleNo: p.styleNo ?? "",
      brand: p.brand ?? "",
      season: p.season ?? "",
      gender: p.gender ?? "",
      productType: p.productType ?? "",
      buyerBrand: p.buyerBrand ?? "",
    });
    const sel: Record<string, string[]> = {};
    const g: Record<string, { gtin: string; gtinStatus: string }> = {};
    for (const c of p.colors) sel[String(c._id)] = [];
    for (const va of (v.data.variants ?? []) as Variant[]) {
      if (!va.active) continue;
      const cid = String(va.colorId);
      (sel[cid] ??= []).push(va.sizeKey);
      g[pairKey(cid, va.sizeKey)] = { gtin: va.gtin ?? "", gtinStatus: va.gtinStatus ?? "GTIN Pending" };
    }
    setSelected(sel);
    setGtins(g);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const system = useMemo(
    () => systems.find((s) => s.key === (product?.sizeSystemKey ?? pendingSystem)),
    [systems, product, pendingSystem]
  );
  const sizeOpts = useMemo(() => system?.options ?? [], [system]);
  const sizeLabel = useCallback((k: string) => sizeOpts.find((o) => o.key === k)?.label ?? k, [sizeOpts]);
  const activeColors = useMemo(
    () => [...(product?.colors ?? [])].filter((c) => c.status !== "archived").sort((a, b) => a.sortOrder - b.sortOrder),
    [product]
  );
  const totalVariants = useMemo(
    () => Object.values(selected).reduce((n, arr) => n + arr.length, 0),
    [selected]
  );

  function patchColor(cid: string, patch: Partial<Color>) {
    setProduct((p) =>
      p ? { ...p, colors: p.colors.map((c) => (String(c._id) === cid ? { ...c, ...patch } : c)) } : p
    );
  }

  function addColors(n: number, base = "") {
    if (!product) return;
    if (activeColors.length + n > MAX_COLORS) {
      setErr(`Maximum ${MAX_COLORS} colors`);
      return;
    }
    const now = Date.now();
    const fresh: Color[] = Array.from({ length: n }, (_, i) => ({
      _id: `new-${now}-${i}`,
      name: base || `Color ${activeColors.length + i + 1}`,
      images: [],
      status: "active",
      sortOrder: (product.colors.length + i),
    }));
    setProduct({ ...product, colors: [...product.colors, ...fresh] });
    setSelected((s) => {
      const next = { ...s };
      for (const c of fresh) next[c._id] = [];
      return next;
    });
  }

  function renameColor(cid: string, name: string) {
    if (!product) return;
    const clash = product.colors.some(
      (c) => String(c._id) !== cid && c.status !== "archived" && c.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (clash && name.trim() !== "") {
      if (!window.confirm(`A color named "${name.trim()}" already exists. Use this duplicate name anyway?`)) return;
    }
    patchColor(cid, { name });
  }

  function removeColor(cid: string) {
    const c = product?.colors.find((x) => String(x._id) === cid);
    if (!c) return;
    const hasData = (selected[cid] ?? []).length > 0 || (c.images?.length ?? 0) > 0;
    if (!window.confirm(hasData
      ? `Remove color "${c.name}" with its ${selected[cid]?.length ?? 0} size(s) and images? Archived GTINs are kept.`
      : `Remove color "${c.name}"?`)) return;
    patchColor(cid, { status: "archived" });
    setSelected((s) => {
      const next = { ...s };
      delete next[cid];
      return next;
    });
  }

  function moveColor(cid: string, dir: -1 | 1) {
    if (!product) return;
    const arr = [...product.colors].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = arr.findIndex((c) => String(c._id) === cid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setProduct({ ...product, colors: arr.map((c, k) => ({ ...c, sortOrder: k })) });
  }

  function toggleSize(cid: string, size: string) {
    setSelected((s) => {
      const cur = s[cid] ?? [];
      const has = cur.includes(size);
      if (has && (gtins[pairKey(cid, size)]?.gtin ?? "") !== "") {
        if (!window.confirm("Deselect this size? Its GTIN will be archived and restored if you re-select.")) return s;
      }
      return { ...s, [cid]: has ? cur.filter((x) => x !== size) : [...cur, size] };
    });
  }

  async function uploadImage(cid: string, file: File) {
    if (file.size > 5_000_000) {
      setErr("Image too large (max 5 MB)");
      return;
    }
    setUploading(cid);
    setErr("");
    try {
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "color_image", productId: id }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error ?? "Sign failed");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", String(sign.timestamp));
      fd.append("folder", sign.folder);
      fd.append("type", sign.type);
      fd.append("signature", sign.signature);
      const up = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error?.message ?? "Upload failed");
      patchColor(cid, {
        images: [
          ...(product?.colors.find((c) => String(c._id) === cid)?.images ?? []),
          { publicId: data.public_id, secureUrl: data.secure_url, altText: file.name },
        ],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading("");
    }
  }

  async function changeSystem(next: string) {
    if (!product || next === product.sizeSystemKey) {
      setPendingSystem(next);
      return;
    }
    if (totalVariants > 0) {
      const ok = window.confirm(
        `Change size system? This archives ${totalVariants} existing variant(s). Choose OK to Reset, Cancel to keep the current system. Sizes are never auto-mapped.`
      );
      if (!ok) {
        setPendingSystem(product.sizeSystemKey ?? "");
        return;
      }
      setSaving(true);
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeSystemKey: next, resetVariants: true }),
      });
      setSaving(false);
      if (!res.ok) {
        const b = await res.json();
        setErr(b.error ?? "System change failed");
        return;
      }
      setSelected(Object.fromEntries((product.colors ?? []).map((c) => [String(c._id), []])));
      setGtins({});
    }
    setPendingSystem(next);
    setProduct({ ...product, sizeSystemKey: next });
  }

  async function save(final: boolean) {
    if (!product) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const blanks = activeColors.filter((c) => !c.name.trim());
      if (blanks.length > 0) throw new Error("Every color needs a name.");
      if (final && activeColors.length === 0) throw new Error("Add at least one color.");
      // 1) header + colors (map temp ids after save)
      const colorPayload = activeColors.map((c, i) => ({
        _id: c._id.startsWith("new-") ? undefined : c._id,
        name: c.name.trim(),
        colorCode: c.colorCode?.trim() || undefined,
        images: c.images.map((im, j) => ({ ...im, sortOrder: j })),
        sortOrder: i,
        status: "active" as const,
      }));
      const archived = product.colors
        .filter((c) => c.status === "archived" && !c._id.startsWith("new-"))
        .map((c) => ({ _id: String(c._id), name: c.name, status: "archived" as const }));
      const pRes = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...header,
          sizeSystemKey: pendingSystem || undefined,
          colors: [...colorPayload, ...archived],
        }),
      });
      const pBody = await pRes.json();
      if (!pRes.ok) throw new Error(apiErrorMessage(pBody, PRODUCT_LABELS));
      const saved: Product = pBody.data;
      // remap: match by order for new colors
      const realByIndex = [...saved.colors].filter((c) => c.status !== "archived").sort((a, b) => a.sortOrder - b.sortOrder);
      const idMap = new Map<string, string>();
      activeColors.forEach((c, i) => idMap.set(String(c._id), String(realByIndex[i]?._id ?? c._id)));
      // 2) variants
      const vRows = activeColors.flatMap((c) => {
        const real = idMap.get(String(c._id))!;
        return (selected[String(c._id)] ?? []).map((sizeKey) => {
          const g = gtins[pairKey(String(c._id), sizeKey)] ?? { gtin: "", gtinStatus: "GTIN Pending" };
          return { colorId: real, sizeKey, gtin: g.gtin.trim() || undefined, gtinStatus: g.gtinStatus };
        });
      });
      const vRes = await fetch(`/api/products/${id}/variants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: vRows, final }),
      });
      const vBody = await vRes.json();
      if (!vRes.ok) throw new Error(apiErrorMessage(vBody, VARIANT_LABELS, "Variant sync failed"));
      await load(id);
      setMsg(final ? `Saved — ${vRows.length} active variant(s).` : "Draft saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (busy || !product) {
    return <div className="card p-8 text-center text-sm text-forest-900/60">Loading variants…</div>;
  }

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-800">{msg}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{err}</p>}

      <CollapsibleSection id="variants" level={1} help={() => startTour("variants", "variants")} title="1. Product Variants"
        summary={`${activeColors.length} colors, ${totalVariants} variants`} defaultOpen>
        <div className="space-y-3">
          <CollapsibleSection id="variants-system" level={2} help={() => startTour("variants", "variants-system")} title="1.1 Product Overview & Size System"
            summary={system ? `${header.brand ? header.brand + " · " : ""}${system.name}` : "Product overview & size system"} defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label" htmlFor="h-name">Product Name</label>
                <input id="h-name" className="input" placeholder="e.g. Organic Cotton Tee" value={header.name}
                  onChange={(e) => setHeader({ ...header, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="h-styleNo">Style no.</label>
                <input id="h-styleNo" className="input" placeholder="e.g. SS26-01" value={header.styleNo}
                  onChange={(e) => setHeader({ ...header, styleNo: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="h-brand">Brand name</label>
                <input id="h-brand" className="input" placeholder="e.g. EcoWear" value={header.brand}
                  onChange={(e) => setHeader({ ...header, brand: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="h-season">Season</label>
                <select id="h-season" className="input" value={header.season}
                  onChange={(e) => setHeader({ ...header, season: e.target.value })}>
                  <option value="">Select season…</option>
                  <option value="Spring/Summer">1. Spring/Summer</option>
                  <option value="Autumn/Winter">2. Autumn/Winter</option>
                  <option value="All season">3. All season</option>
                  <option value="Other">4. Other</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="h-gender">Gender</label>
                <select id="h-gender" className="input" value={header.gender}
                  onChange={(e) => setHeader({ ...header, gender: e.target.value })}>
                  <option value="">Select gender…</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                  <option value="Mens">Mens</option>
                  <option value="Womens">Womens</option>
                  <option value="Unisex">Unisex</option>
                  <option value="Baby unisex">Baby unisex</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="h-productType">Product type</label>
                <input id="h-productType" className="input" placeholder="e.g. T-Shirt" value={header.productType}
                  onChange={(e) => setHeader({ ...header, productType: e.target.value })} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 border-t border-forest-100 pt-3">
                <label className="label" htmlFor="sys">Size system</label>
                <select id="sys" className="input max-w-xs" value={pendingSystem}
                  onChange={(e) => changeSystem(e.target.value)}>
                  <option value="">Select a system…</option>
                  {systems.map((s) => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-forest-900/60">Changing systems archives existing variants (Reset) — never auto-maps sizes.</p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="variants-colors" level={2} help={() => startTour("variants", "variants-colors")} title="1.2 Colors and Images"
            summary={`${activeColors.length} color(s)`} defaultOpen>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1" aria-label="Color count stepper">
                <span className="text-xs font-bold text-forest-900/60">Quick:</span>
                {[2, 3, 4, 5].map((n) => (
                  <button key={n} className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => addColors(Math.max(0, n - activeColors.length))}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input !w-44" placeholder="New color name"
                  value={newColorName} onChange={(e) => setNewColorName(e.target.value)} aria-label="New color name" />
                <button className="btn-secondary !py-2 text-xs"
                  onClick={() => { addColors(1, newColorName.trim()); setNewColorName(""); }}>
                  + Add Color
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {activeColors.map((c) => {
                const cid = String(c._id);
                return (
                  <CollapsibleSection key={cid} id={`color-${cid}`} level={3}
                    title={c.name || "(unnamed color)"}
                    summary={`${(selected[cid] ?? []).length} size(s) · ${(c.images ?? []).length} image(s)`}>
                    <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                      <div>
                        <label className="label" htmlFor={`cn-${cid}`}>Color name *</label>
                        <input id={`cn-${cid}`} className="input" value={c.name}
                          onChange={(e) => renameColor(cid, e.target.value)} />
                      </div>
                      <div>
                        <label className="label" htmlFor={`cc-${cid}`}>Color code</label>
                        <input id={`cc-${cid}`} className="input" value={c.colorCode ?? ""}
                          onChange={(e) => patchColor(cid, { colorCode: e.target.value })} placeholder="BLK" />
                      </div>
                      <div className="flex items-end gap-1.5">
                        <button className="btn-secondary !px-2.5 !py-2 text-xs" title="Move color up"
                          onClick={() => moveColor(cid, -1)}>↑ Up</button>
                        <button className="btn-secondary !px-2.5 !py-2 text-xs" title="Move color down"
                          onClick={() => moveColor(cid, 1)}>↓ Down</button>
                        <button className="btn-secondary !px-3 !py-2 text-xs !text-red-700" title="Remove this color"
                          onClick={() => removeColor(cid)}>Remove</button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="label">Images</p>
                      <div className="flex flex-wrap gap-2">
                        {(c.images ?? []).map((im, i) => (
                          <div key={i} className="w-28 overflow-hidden rounded-xl ring-1 ring-forest-100">
                            {im.secureUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={im.secureUrl} alt={im.altText ?? c.name} className="h-20 w-full object-cover" />
                            ) : (
                              <div className="grid h-20 place-items-center bg-forest-50 text-xs">no preview</div>
                            )}
                            <input className="w-full border-t border-forest-100 px-1.5 py-1 text-[11px]"
                              value={im.altText ?? ""} placeholder="Alt text"
                              aria-label={`Alt text for image ${i + 1} of ${c.name}`}
                              onChange={(e) => {
                                const imgs = [...(c.images ?? [])];
                                imgs[i] = { ...imgs[i], altText: e.target.value };
                                patchColor(cid, { images: imgs });
                              }} />
                            <button className="w-full py-1 text-[11px] font-bold text-red-700 hover:bg-red-50"
                              onClick={() => patchColor(cid, { images: (c.images ?? []).filter((_, k) => k !== i) })}>
                              Remove
                            </button>
                          </div>
                        ))}
                        <label className="grid h-20 w-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-forest-200 text-xs font-bold text-forest-700 hover:bg-forest-50">
                          {uploading === cid ? "…" : "+ Upload"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadImage(cid, f);
                              e.target.value = "";
                            }} />
                        </label>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="label">Sizes for {c.name || "this color"}</p>
                      {!pendingSystem || sizeOpts.length === 0 ? (
                        <p className="text-xs text-forest-900/60">Select a size system first (1.1).</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sizeOpts.map((o) => {
                            const on = (selected[cid] ?? []).includes(o.key);
                            return (
                              <label key={o.key}
                                className={`cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-bold ring-1 transition ${on ? "bg-forest-700 text-white ring-forest-700" : "bg-white text-forest-800 ring-forest-200 hover:bg-forest-50"}`}>
                                <input type="checkbox" className="sr-only" checked={on}
                                  onChange={() => toggleSize(cid, o.key)} />
                                {o.label}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                );
              })}
              {activeColors.length === 0 && (
                <p className="text-sm text-forest-900/60">No colors yet — add the first one above.</p>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="variants-gtin" level={2} help={() => startTour("variants", "variants-gtin")} title="1.3 GTIN Mapping"
            summary={`${totalVariants} GTIN row(s)`}>
            <FieldHint>
              GTINs are entered as-is — never generated. Keep leading zeros; changing one archives the
              old number so history stays intact. <HelpLink anchor="help-workflow" label="GTIN rules" />
            </FieldHint>
            {activeColors.map((c) => {
              const cid = String(c._id);
              const sizes = selected[cid] ?? [];
              if (sizes.length === 0) return null;
              return (
                <CollapsibleSection key={cid} id={`gtin-${cid}`} level={3}
                  title={`${c.name} — ${sizes.length} GTIN(s)`}
                  summary={sizes.map(sizeLabel).join(", ")}>
                  <div className="space-y-2">
                    {sizes.map((sk) => {
                      const g = gtins[pairKey(cid, sk)] ?? { gtin: "", gtinStatus: "GTIN Pending" };
                      return (
                        <div key={sk} className="grid gap-2 sm:grid-cols-[1fr_170px]">
                          <div>
                            <label className="label" htmlFor={`g-${cid}-${sk}`}>
                              {c.name} / {sizeLabel(sk)} - GTIN
                            </label>
                            <input id={`g-${cid}-${sk}`} className="input font-mono" inputMode="numeric"
                              value={g.gtin} placeholder="e.g. 0123456789012"
                              onChange={(e) => setGtins((prev) => ({
                                ...prev,
                                [pairKey(cid, sk)]: { ...g, gtin: e.target.value.trimStart() },
                              }))}
                              onBlur={(e) => setGtins((prev) => ({
                                ...prev,
                                [pairKey(cid, sk)]: { ...g, gtin: e.target.value.trim() },
                              }))} />
                          </div>
                          <div>
                            <label className="label" htmlFor={`gs-${cid}-${sk}`}>Status</label>
                            <select id={`gs-${cid}-${sk}`} className="input"
                              value={g.gtinStatus}
                              onChange={(e) => setGtins((prev) => ({
                                ...prev,
                                [pairKey(cid, sk)]: { ...g, gtinStatus: e.target.value },
                              }))}>
                              {["Draft", "GTIN Pending", "Valid", "Invalid"].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              );
            })}
            {totalVariants === 0 && (
              <p className="text-sm text-forest-900/60">No sizes selected yet — tick sizes per color in 1.2.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="variants-summary" level={2} help={() => startTour("variants", "variants-summary")} title="1.4 Summary"
            summary={`${activeColors.length} colors, ${totalVariants} variants`}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="ok">{activeColors.length} colors</StatusBadge>
              <StatusBadge tone="ok">{totalVariants} variants</StatusBadge>
              {sizeOpts.length > 0 && <StatusBadge tone="neutral">{system?.name}</StatusBadge>}
            </div>
            <ul className="mt-2 text-sm text-forest-900/70">
              {activeColors.map((c) => (
                <li key={String(c._id)}>
                  <strong>{c.name}:</strong> {(selected[String(c._id)] ?? []).map(sizeLabel).join(", ") || "no sizes"}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-forest-100 pt-3">
            {msg && <p className="mr-auto text-sm font-semibold text-forest-800">{msg}</p>}
            {err && <p role="alert" className="mr-auto text-sm font-semibold text-red-700">{err}</p>}
            <button onClick={() => save(false)} disabled={saving} className="btn-secondary !py-2 text-xs">
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button onClick={() => save(true)} disabled={saving} className="btn-primary !py-2 text-xs">
              Review & Save
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
