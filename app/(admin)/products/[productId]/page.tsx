"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VariantsSection } from "@/components/product/VariantsSection";
import { MaterialsSection } from "@/components/product/MaterialsSection";
import { TraceabilitySection } from "@/components/product/TraceabilitySection";
import { QualitySection } from "@/components/product/QualitySection";
import { PackagingSection } from "@/components/product/PackagingSection";
import { EnvironmentalSection } from "@/components/product/EnvironmentalSection";
import { CertificationSection } from "@/components/product/CertificationSection";
import { ReviewSection } from "@/components/product/ReviewSection";

const NAV: [string, string][] = [
  ["sec-variants", "01 Variants"],
  ["sec-materials", "02 Materials"],
  ["sec-traceability", "03 Traceability"],
  ["sec-quality", "04 Quality"],
  ["sec-packaging", "05 Packaging"],
  ["sec-environment", "06 Environment"],
  ["sec-certification", "07 Certification"],
  ["sec-review", "08 Review & Publish"],
];

type Product = {
  productId: string;
  name?: string;
  styleNo?: string;
  brand?: string;
  season?: string;
  gender?: string;
  status: string;
};

export default function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const [id, setId] = useState("");
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    params.then((p) => {
      setId(p.productId);
      fetch(`/api/products/${p.productId}`)
        .then((r) => r.json())
        .then((b) => setProduct(b.data ?? null))
        .catch(() => setProduct(null));
    });
  }, [params]);

  return (
    <div className="space-y-6">
      {/* product header */}
      <div data-tour="product-header" className="card flex flex-wrap items-center gap-3 p-5">
        <Link href="/products" className="btn-secondary !py-2 text-xs no-print">
          ← Products
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-tight text-forest-950">
              {product ? product.name || product.productId : "Loading…"}
            </h1>
            {product?.brand && (
              <span className="badge bg-forest-100 font-bold text-forest-800">
                {product.brand}
              </span>
            )}
            {product?.season && (
              <span className="badge bg-mint-100 font-semibold text-forest-900">
                {product.season}
              </span>
            )}
            {product?.gender && (
              <span className="badge bg-stone-100 font-semibold text-stone-700">
                {product.gender}
              </span>
            )}
          </div>
          {product && (
            <p className="mt-1 text-sm text-forest-900/60">
              <span className="font-mono font-semibold">{product.productId}</span>
              {product.styleNo ? ` · Style ${product.styleNo}` : ""}
              {` · ${product.status}`}
            </p>
          )}
        </div>
      </div>

      {/* sticky section nav */}
      <nav data-tour="section-nav" aria-label="Passport sections" className="no-print sticky top-0 z-20 -mx-1 flex gap-1.5 overflow-x-auto bg-[#f6fbf7]/95 px-1 py-2 backdrop-blur">
        {NAV.map(([anchor, label]) => (
          <a
            key={anchor}
            href={`#${anchor}`}
            className="whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-[13px] font-bold text-forest-800 ring-1 ring-forest-100 hover:bg-forest-50"
          >
            {label}
          </a>
        ))}
      </nav>

      {id ? (
        <>
          <section id="sec-variants" className="scroll-mt-32">
            <VariantsSection productId={id} />
          </section>
          <section id="sec-materials" className="scroll-mt-32">
            <MaterialsSection productId={id} />
          </section>
          <section id="sec-traceability" className="scroll-mt-32">
            <TraceabilitySection productId={id} />
          </section>
          <section id="sec-quality" className="scroll-mt-32">
            <QualitySection productId={id} />
          </section>
          <section id="sec-packaging" className="scroll-mt-32">
            <PackagingSection productId={id} />
          </section>
          <section id="sec-environment" className="scroll-mt-32">
            <EnvironmentalSection productId={id} />
          </section>
          <section id="sec-certification" className="scroll-mt-32">
            <CertificationSection productId={id} />
          </section>
          <section id="sec-review" className="scroll-mt-32">
            <ReviewSection productId={id} />
          </section>
        </>
      ) : (
        <div className="card p-8 text-center text-sm text-forest-900/60">Loading product…</div>
      )}
    </div>
  );
}
