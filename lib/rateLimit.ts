type Entry = { count: number; resetAt: number };

const hits = new Map<string, Entry>();

/**
 * Fixed-window in-memory rate limit (~60 req/min/IP default).
 * Best-effort for a single instance; use edge/Redis limits for multi-instance.
 */
export function rateLimit(key: string, limit = 60, windowMs = 60_000): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now >= e.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  e.count++;
  if (e.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((e.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function rateLimitKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd?.split(",")[0] ?? "").trim() || "unknown";
  return `public:${ip}`;
}
