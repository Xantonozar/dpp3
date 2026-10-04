"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";

type Props = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  summary?: string;
  hasError?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  help?: () => void;
  children: React.ReactNode;
};

export function CollapsibleSection({
  id,
  level,
  title,
  summary,
  hasError,
  defaultOpen = false,
  forceOpen,
  help,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dpp:open:${id}`);
      if (saved !== null) setOpen(saved === "1");
      else if (window.location.hash === `#${id}`) setOpen(true);
    } catch {
      /* storage unavailable */
    }
  }, [id]);

  useEffect(() => {
    if (forceOpen || hasError) setOpen(true);
  }, [forceOpen, hasError]);

  useEffect(() => {
    if (window.location.hash === `#${id}`) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [id, open]);

  // Deep-link while already on the page (hash-only navigation doesn't remount).
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id]);

  // Print / PDF export expands everything (A8A acceptance).
  useEffect(() => {
    const expand = () => toggle(true);
    window.addEventListener("beforeprint", expand);
    return () => window.removeEventListener("beforeprint", expand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggle = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(`dpp:open:${id}`, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <section
      id={id}
      className={`card overflow-hidden ${level === 1 ? "" : "shadow-none"}`}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => toggle(!open)}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="sec-head flex-1"
        >
          <span
            aria-hidden
            className={`grid size-7 shrink-0 place-items-center rounded-lg text-sm font-black transition ${
              open ? "bg-forest-700 text-white" : "bg-forest-100 text-forest-700"
            }`}
          >
            {open ? "–" : "+"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold text-forest-950">
              {title}
            </span>
            {!open && summary && (
              <span className="block truncate text-xs font-medium text-forest-900/55">
                {summary}
              </span>
            )}
          </span>
          {hasError && (
            <span
              className="size-2.5 shrink-0 rounded-full bg-red-500"
              title="Needs attention"
              aria-label="Section has errors"
            />
          )}
          <StatusBadge tone={open ? "open" : "closed"}>
            {open ? "Open" : "Show"}
          </StatusBadge>
        </button>
        {help && (
          <button
            type="button"
            onClick={help}
            aria-label={`Take a tour of ${title}`}
            title="Take a tour of this section"
            className="mr-4 ml-2 grid size-6 shrink-0 place-items-center rounded-full border border-forest-200 bg-white text-xs font-black text-forest-700 transition hover:bg-forest-100 focus-visible:outline-2 focus-visible:outline-forest-500"
          >
            ?
          </button>
        )}
      </div>
      {open && (
        <div id={`${id}-body`} className="sec-body">
          {children}
        </div>
      )}
    </section>
  );
}
