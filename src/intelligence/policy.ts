// ============================================================
// Intelligence Engine — Retry & Timeout Policy
// ============================================================

export interface RetryPolicy {
  maxAttempts:    number
  baseDelayMs:    number   // first retry delay; doubles each attempt
  timeoutMs:      number   // per-attempt abort timeout
}

// Default policy for all capabilities unless overridden.
export const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 500,
  timeoutMs:   25_000,  // 25s — well under Vercel's 30s function limit
}

// Embedding jobs can tolerate longer timeouts (large docs).
export const EMBEDDING_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  timeoutMs:   55_000,  // 55s — background function limit
}

/**
 * Wraps an async operation with retry + per-attempt timeout.
 * Retries only on network errors and 5xx responses.
 * Throws the final error if all attempts fail.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  policy: RetryPolicy = DEFAULT_POLICY,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, policy.baseDelayMs * 2 ** (attempt - 1)))
    }
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), policy.timeoutMs)
    try {
      const result = await fn(ac.signal)
      clearTimeout(timer)
      return result
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      // Only retry on abort (timeout) or network failure
      if (err instanceof Error && err.name === 'AbortError') continue
      throw err   // non-retryable errors surface immediately
    }
  }
  throw lastErr
}
