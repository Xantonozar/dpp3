// Dispatches a tour request handled by TourProvider (mounted in the admin layout).
// key: "list" | "product" | a SECTION_TOURS key (section/page tour).
// startId: optional element id to begin from (a sub-section's own "?" button).
export function startTour(key: string, startId?: string) {
  window.dispatchEvent(new CustomEvent("dpp:tour", { detail: { key, startId } }));
}
