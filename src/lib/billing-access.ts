// ============================================================
// billing-access.ts
// Determines whether an organization's account is locked out
// (read-only mode) due to a billing issue.
//
// Lockout conditions:
//   1. past_due + grace window expired (payment failure dunning)
//   2. canceled + trial has expired (free_trial ended with no plan)
//
// Used by:
//   - BillingLockoutGate (client-side overlay in DashboardShell)
//   - requireActiveBilling() (API route guard for write operations)
// ============================================================
import type { Organization } from '@/types'

export type LockoutReason = 'payment_failed' | 'trial_expired' | null

/**
 * Returns the lockout reason if the org is in read-only mode,
 * or null if the account is in good standing.
 *
 * "In good standing" includes: active, trialing (within window),
 * canceled-but-grace-still-running, or past_due within grace window.
 */
export function getLockoutReason(org: Organization | null | undefined): LockoutReason {
  if (!org) return null

  const now = Date.now()

  // ── past_due + grace period expired ───────────────────────
  if (org.subscription_status === 'past_due') {
    if (org.grace_period_ends_at && new Date(org.grace_period_ends_at).getTime() < now) {
      return 'payment_failed'
    }
    // Still within grace window — not locked yet
    return null
  }

  // ── Trial expired with no active subscription ──────────────
  // free_trial tier + canceled status + trial_ends_at in the past
  if (
    org.subscription_status === 'canceled' &&
    org.subscription_tier   === 'free_trial' &&
    org.trial_ends_at       !== null &&
    new Date(org.trial_ends_at).getTime() < now
  ) {
    return 'trial_expired'
  }

  return null
}

/** True if the org is in full read-only lockout. */
export function isOrgLocked(org: Organization | null | undefined): boolean {
  return getLockoutReason(org) !== null
}

/** Grace period remaining in ms (0 if expired or no grace). */
export function gracePeriodRemainingMs(org: Organization | null | undefined): number {
  if (!org?.grace_period_ends_at) return 0
  return Math.max(0, new Date(org.grace_period_ends_at).getTime() - Date.now())
}

// ── Plan tier helpers ─────────────────────────────────────────

const TIER_ORDER: Record<string, number> = {
  free_trial:   0,
  field_pro:    1,
  starter:      2,
  professional: 3,
  enterprise:   4,
}

/**
 * Checks whether the org's subscription_tier meets `minTier`.
 * Returns { allowed, requiredTier }.
 */
export function requirePlanTier(
  org: Organization | null | undefined,
  minTier: string,
): { allowed: boolean; requiredTier: string } {
  const current = org?.subscription_tier ?? 'free_trial'
  const currentRank = TIER_ORDER[current] ?? 0
  const requiredRank = TIER_ORDER[minTier] ?? 0
  return {
    allowed:      currentRank >= requiredRank,
    requiredTier: minTier,
  }
}
