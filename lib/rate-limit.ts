// lib/rate-limit.ts
//
// In-memory fixed-window rate limiter.
//
// - Keyed buckets of request timestamps.
// - Configurable limit and window per call site.
// - Bounded memory: stale entries are removed on access, and the
//   map is hard-capped with oldest-entry eviction.
//
// NOTE: This is per-process state. It resets on restart and does not
// share state across serverless instances — acceptable for a single
// Node deployment, not for multi-instance serverless without Redis.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Hard cap on tracked keys. When reached, expired buckets are removed
// first, then the oldest remaining keys are evicted (Map preserves
// insertion order).
const MAX_BUCKETS = 10_000;

// Longest window any caller may use — anything older is useless to
// every rate-limit check and is safe to evict.
const MAX_WINDOW_MS = 15 * 60 * 1000;

export const DEFAULT_RATE_LIMIT = 100;
export const DEFAULT_WINDOW_MS = 60 * 1000;

function evictStaleBuckets() {
  const now = Date.now();

  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < MAX_WINDOW_MS);
    if (bucket.hits.length === 0) {
      buckets.delete(key);
    }
  }
}

function evictIfNeeded() {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  evictStaleBuckets();

  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    buckets.delete(oldestKey);
  }
}

/*
    Check whether a key is within its rate limit.

    Returns true when the request is allowed, false when limited.
    Timestamps older than windowMs are discarded before counting.
*/
export function rateLimit(
  key: string,
  limit: number = DEFAULT_RATE_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const now = Date.now();

  evictIfNeeded();

  const bucket = buckets.get(key);
  const hits = (bucket?.hits ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    bucket!.hits = hits;
    return false;
  }

  hits.push(now);
  buckets.set(key, { hits });

  return true;
}

/*
    Best-effort client IP extraction.

    Preference order:
    1. x-vercel-forwarded-for (set authoritatively by Vercel's edge)
    2. x-real-ip (set by most reverse proxies / platforms)
    3. Rightmost x-forwarded-for entry — appended by the nearest
       trusted proxy, so it is the least client-spoofable entry.
    4. 'unknown' — all such clients share one bucket.

    CAVEAT: When the app is exposed directly (no trusted proxy),
    every forwarding header is client-controlled and IP-based limits
    can be bypassed. Per-account limits (e.g. login:email:*) remain
    effective regardless. Do not rely on IP limiting alone.
*/
export function getClientIP(request: { headers: Headers }): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return 'unknown';
}
