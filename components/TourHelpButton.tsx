"use client";

import { startTour } from "@/components/tour/startTour";

// Round "?" used outside CollapsibleSection headers (catalog cards etc.).
export function TourHelpButton({
  tourKey,
  startId,
  label,
  className = "",
}: {
  tourKey: string;
  startId?: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => startTour(tourKey, startId)}
      aria-label={`Take a tour of ${label}`}
      title="Take a mini-tour"
      className={`grid size-6 shrink-0 place-items-center rounded-full border border-forest-200 bg-white text-xs font-black text-forest-700 transition hover:bg-forest-100 focus-visible:outline-2 focus-visible:outline-forest-500 ${className}`}
    >
      ?
    </button>
  );
}
