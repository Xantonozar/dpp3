"use client";

import { startTour } from "@/components/tour/startTour";

// Triggers a TourProvider tour. `kind`:
//   "list"   — products dashboard tour (from /products or /help)
//   "product" — product page tour (from the product page itself)
export function TakeTourButton({
  kind = "list",
  className = "btn-secondary !py-2 text-xs",
  children = "Take the tour",
}: {
  kind?: "list" | "product";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-tour="take-tour"
      className={className}
      onClick={() => startTour(kind)}
    >
      {children}
    </button>
  );
}
