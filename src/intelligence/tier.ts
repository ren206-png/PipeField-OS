// ============================================================
// Intelligence Engine — Tier Gating
//
// Reuses the existing subscription-tier logic from src/lib/plans.ts
// and src/lib/usage.ts. Does NOT reimplement it.
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'
import type { CapabilityDescriptor } from './types'

/**
 * Fetches the organization's current subscription tier.
 * Returns 'starter' as a safe default if lookup fails.
 */
export async function getOrgTier(organizationId: string): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('organizations')
      .select('subscription_tier')
      .eq('id', organizationId)
      .maybeSingle()
    return data?.subscription_tier ?? 'starter'
  } catch {
    return 'starter'
  }
}

/**
 * Returns true if the organization's tier is allowed to use
 * the given capability.
 *
 * Empty requiredTiers array means the capability is available
 * to all tiers (including free_trial).
 */
export function isTierAllowed(
  descriptor: CapabilityDescriptor,
  orgTier: string,
): boolean {
  if (descriptor.requiredTiers.length === 0) return true
  return descriptor.requiredTiers.includes(orgTier)
}

/**
 * Returns a human-readable message for tier-blocked capabilities.
 */
export function tierBlockedMessage(descriptor: CapabilityDescriptor): string {
  const tiers = descriptor.requiredTiers.join(', ')
  return (
    `The "${descriptor.name}" capability requires a ${tiers} plan or higher. ` +
    `Upgrade your subscription to access it.`
  )
}
