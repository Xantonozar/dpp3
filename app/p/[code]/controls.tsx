"use client";

import { useEffect, useState } from "react";

// Progressive enhancement only: the page fully works with JS disabled.
export function PublicControls({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false);

  function setAll(open: boolean) {
    document.querySelectorAll("main details").forEach((el) => {
      (el as HTMLDetailsElement).open = open;
    });
    setExpanded(open);
  }

  // Print / PDF export expands everything (A8A acceptance).
  useEffect(() => {
    const expand = () => setAll(true);
    window.addEventListener("beforeprint", expand);
    return () => window.removeEventListener("beforeprint", expand);
  }, []);

  return (
    <div className="no-print mt-3 flex flex-wrap gap-2">
      <button onClick={() => setAll(!expanded)} className="btn-secondary !py-1.5 text-xs">
        {expanded ? "Collapse all" : "Expand all"}
      </button>
      <button
        onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}/p/${code}`)}
        className="btn-secondary !py-1.5 text-xs"
      >
        Copy link
      </button>
    </div>
  );
}
