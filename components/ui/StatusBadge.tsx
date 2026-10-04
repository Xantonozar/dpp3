type Props = {
  children: React.ReactNode;
  tone?: "open" | "closed" | "ok" | "warn" | "error" | "neutral";
};

const TONES: Record<string, string> = {
  open: "bg-forest-700 text-white",
  closed: "bg-forest-100 text-forest-800",
  ok: "bg-forest-100 text-forest-800",
  warn: "bg-amber-100 text-amber-900",
  error: "bg-red-100 text-red-800",
  neutral: "bg-stone-100 text-stone-700",
};

export function StatusBadge({ children, tone = "neutral" }: Props) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}
