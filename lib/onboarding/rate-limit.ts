// Lightweight in-memory rate limiter keyed by an arbitrary string (typically an IP).
//
// Implementation: a module-scoped Map<string, number[]> of request timestamps.
// Each call prunes timestamps older than the window before deciding.
//
// Cold-start limitation: because the state lives in module scope, every serverless
// cold start (and every parallel instance) has its own independent counter. A
// determined caller can therefore exceed the nominal limit by spreading traffic
// across instances. This is acceptable for v1 of the public sample-grade endpoint
// — the plan flags Turnstile (or a Vercel KV / Upstash limiter) as a future
// hardening step.
const buckets = new Map<string, number[]>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const existing = buckets.get(key) ?? [];
  const recent = existing.filter((timestamp) => timestamp > cutoff);

  if (recent.length >= maxRequests) {
    // The oldest still-counted request is what dictates when the next slot opens.
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    // Persist the pruned list so we don't keep re-filtering stale entries.
    buckets.set(key, recent);
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}
