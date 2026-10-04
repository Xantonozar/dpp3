"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { label: "Products", href: "/products" },
  { label: "Catalogs", href: "/admin/catalogs" },
  { label: "Emission factors", href: "/admin/emission-factors" },
  { label: "Quality catalogs", href: "/admin/quality-catalogs" },
  { label: "Help", href: "/help" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-forest-400 to-forest-600 text-[10px] font-black tracking-wider text-white shadow-lg shadow-black/30">
          DPP
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight text-white">
            Garment DPP
          </p>
          <p className="text-[11px] font-medium text-forest-100/50">Admin console</p>
        </div>
      </div>

      <nav data-tour="console-nav" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? "bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-mint-200 before:content-[''] lg:before:-left-3"
                  : "text-forest-100/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-white/10 px-5 py-4 lg:block">
        <p className="text-[11px] font-medium text-forest-100/40">
          Single-admin session
        </p>
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="mt-2.5 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-forest-100 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-400"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
