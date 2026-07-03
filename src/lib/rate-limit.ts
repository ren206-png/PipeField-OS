// ============================================================
// rate-limit.ts — Simple in-memory sliding-window rate limiter.
//
// ⚠️  In-memory only: limits are per-function-instance on Vercel.
//     Multiple instances each have their own counter, so the true
//     effective limit across all instances will be higher than
//     configured. For single-digit RPS abuse prevention this is
//     sufficient; for stricter enforcement upgrade to Upstash Redis:
//     https://github.com/upstash/ratelimit
//
// Usage:
//   const allowed = rateLimit({ key: ip, limit: 5, windowMs: 60_000 })
//   if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
// ============================================================

interface RateLimitWindow {
  count:   number
  resetAt: number
}

// Global store — lives for the lifetime of the serverless function instance.
const store = new Map<string, RateLimitWindow>()

// Prune stale entries periodically to avoid memory leaks.
// Fires at most once every 5 minutes per instance.
let lastPruneAt = 0
function maybePrune() {
  const now = Date.now()
  if (now - lastPruneAt < 5 * 60_000) return
  lastPruneAt = now
  // Use forEach to avoid requiring --downlevelIteration / ES2015 target
  const toDelete: string[] = []
  store.forEach((win, key) => { if (now > win.resetAt) toDelete.push(key) })
  toDelete.forEach(key => store.delete(key))
}

interface RateLimitOptions {
  /** A unique key to track — typically `${route}:${ip}` or `${route}:${orgId}` */
  key:      string
  /** Maximum number of requests allowed in the window */
  limit:    number
  /** Sliding window duration in milliseconds */
  windowMs: number
}

/**
 * Returns `true` if the request should proceed, `false` if it should be blocked.
 * Thread-safe for a single Node.js event loop (no async gaps inside).
 */
export function rateLimit({ key, limit, windowMs }: RateLimitOptions): boolean {
  maybePrune()

  const now = Date.now()
  const win = store.get(key)

  if (!win || now > win.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (win.count >= limit) return false

  win.count++
  return true
}

/** Extracts a best-effort client IP from the Next.js request headers. */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
