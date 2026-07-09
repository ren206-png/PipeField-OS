// ============================================================
// Intelligence Engine — Per-Org Daily Token Accounting
//
// Reads today's token usage from ai_invocations (the audit log).
// Cache key always includes organizationId — never cross-org.
// Enforced only when PFOS_INTELLIGENCE_COST_CONTROLS is ON.
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'
import type { CapabilityName, DailyUsage, TierTokenBudget } from './types'

// Daily token budgets per subscription tier, per capability.
// null = unlimited.
// Adjust these values to match business requirements.
const DEFAULT_DAILY_BUDGETS: TierTokenBudget = {
  free_trial:   5_000,
  field_pro:    10_000,
  starter:      25_000,
  professional: 100_000,
  enterprise:   null,     // unlimited
}

// Some capabilities are more expensive — override here as needed.
const CAPABILITY_BUDGETS: Partial<Record<CapabilityName, TierTokenBudget>> = {
  'rag-qa': DEFAULT_DAILY_BUDGETS,
  'document-embedding': {
    free_trial:   20_000,
    field_pro:    50_000,
    starter:      100_000,
    professional: 500_000,
    enterprise:   null,
  },
}

function getBudgetForTier(
  capability: CapabilityName,
  tier: string,
): number | null {
  const budgets = CAPABILITY_BUDGETS[capability] ?? DEFAULT_DAILY_BUDGETS
  const key = tier as keyof TierTokenBudget
  return key in budgets ? budgets[key] : DEFAULT_DAILY_BUDGETS[key] ?? null
}

/**
 * Returns the organization's daily AI token usage for a given capability.
 * Queries the ai_invocations table scoped strictly to this org.
 *
 * Cache key: organizationId is always included — no cross-tenant reads.
 */
export async function getDailyUsage(
  organizationId: string,
  capability: CapabilityName,
  subscriptionTier: string,
): Promise<DailyUsage> {
  const admin = createAdminClient()

  // Sum tokens used today for this org + capability
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data, error } = await admin
    .from('ai_invocations')
    .select('tokens_used')
    .eq('organization_id', organizationId)
    .eq('capability', capability)
    .eq('status', 'success')
    .gte('invoked_at', todayStart.toISOString())

  if (error) {
    // On query failure, default to allowing the request (fail open)
    console.error('[intelligence.accounting] getDailyUsage error:', error)
    return {
      organizationId,
      capability,
      tokensToday: 0,
      budget:      null,
      withinBudget: true,
    }
  }

  const tokensToday = (data ?? []).reduce((sum, row) => sum + (row.tokens_used ?? 0), 0)
  const budget      = getBudgetForTier(capability, subscriptionTier)
  const withinBudget = budget === null || tokensToday < budget

  return { organizationId, capability, tokensToday, budget, withinBudget }
}

/**
 * Returns a human-readable degradation message shown to the user
 * when the daily budget is exhausted.
 */
export function budgetExhaustedMessage(usage: DailyUsage): string {
  return (
    `Daily AI usage limit reached for this plan ` +
    `(${usage.tokensToday.toLocaleString()} / ${usage.budget?.toLocaleString() ?? '∞'} tokens used today). ` +
    `Usage resets at midnight UTC. Upgrade your plan for a higher limit.`
  )
}
