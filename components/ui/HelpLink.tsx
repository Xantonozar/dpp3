import Link from "next/link";

// Small "?" that opens the matching Help section in a NEW TAB — never
// navigates away from a form with unsaved state.
export function HelpLink({ anchor, label }: { anchor: string; label?: string }) {
  return (
    <Link
      href={`/help#${anchor}`}
      target="_blank"
      rel="noopener"
      aria-label={label ?? "Help for this field"}
      title="Help (opens in a new tab)"
      className="inline-grid size-[18px] shrink-0 place-items-center rounded-full border border-forest-200 bg-white align-middle text-[11px] font-black text-forest-700 transition hover:bg-forest-100"
    >
      ?
    </Link>
  );
}
