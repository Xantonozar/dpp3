"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { summarizeSetup } from "@/lib/setupStatus";

type Item = ReturnType<typeof summarizeSetup>["items"][number];

export function SetupChecklist() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/quality/catalogs").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/emission-factors").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([cats, factors]) => {
      if (cancelled) return;
      const rsl = cats?.data?.rsl as { active?: boolean }[] | undefined;
      const fac = factors?.data as unknown[] | undefined;
      if (!rsl || !fac) return; // stay hidden on any load failure
      const { items: list, ready } = summarizeSetup({
        rslProfiles: rsl.filter((p) => p.active !== false).length,
        emissionFactors: fac.length,
      });
      if (!ready) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) return null;

  return (
    <div className="card border-l-4 border-l-amber-400 p-5" data-testid="setup-checklist">
      <p className="text-sm font-extrabold text-forest-950">Setup checklist</p>
      <p className="mt-0.5 text-xs text-forest-900/60">
        Two background catalogs unlock full data entry — finish these once and the note disappears.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-forest-50 px-3 py-2.5">
            <span className={`size-2.5 shrink-0 rounded-full ${i.done ? "bg-forest-500" : "bg-amber-500"}`} />
            <span className="text-sm font-bold text-forest-950">{i.label}</span>
            <span className="min-w-0 flex-1 text-xs text-forest-900/70">{i.why}</span>
            {!i.done && (
              <Link href={i.href} className="btn-secondary !py-1.5 text-xs">
                {i.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
