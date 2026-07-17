// Idempotency key helpers for Stripe mutations.
// All Stripe calls that create or modify objects MUST use these.
import crypto from 'crypto'

/**
 * Generate a deterministic idempotency key for a Stripe operation.
 * Same inputs always produce the same key — safe for retries.
 * @param operation  - e.g. 'create-customer', 'create-subscription'
 * @param orgId      - tenant organization ID
 * @param suffix     - optional extra disambiguator (e.g. price ID)
 */
export function stripeIdempotencyKey(
  operation: string,
  orgId: string,
  suffix?: string
): string {
  const input = [operation, orgId, suffix].filter(Boolean).join(':')
  // SHA-256 truncated to 36 chars — Stripe max key length is 255, but 36 is enough
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 36)
}
