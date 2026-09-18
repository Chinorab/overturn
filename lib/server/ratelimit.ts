import "server-only";

/**
 * Demo-grade rate limit: a token bucket per client IP, in memory, per serverless
 * instance. Enough to stop a runaway script from draining the API budget during
 * judging; not a substitute for real infrastructure, and documented as such.
 */
const WINDOW_MS = 15 * 60 * 1000;
const parsed = Number(process.env.OVERTURN_RATE_LIMIT);
const MAX_PER_WINDOW = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;

const buckets = new Map<string, number[]>();

export function checkRateLimit(ip: string): { ok: true } | { ok: false; retry_after_s: number } {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return { ok: false, retry_after_s: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  buckets.set(ip, recent);
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) ?? "unknown";
}
