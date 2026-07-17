// ============================================================
// api-billing-guard.ts
// Server-side guard for API write routes.
//
// Usage in any POST/PATCH/DELETE route:
//
//   const { caller, error: authError } = await requireAuth(req)
//   if (authError) return authError
//
//   const billingError = await requireActiveBilling(caller.organization_id)
//   if (billingError) return billingError
//
// Returns a 402 Payment Required response when the org is locked.
// Returns null when billing is in good standing (write is allowed).
//
// Reads directly from the DB (admin client) so it's always
// consistent — never relies on cached org state in the JWT.
//
// NOT applied to GET routes (read-only is fine during lockout).
// NOT applied to /api/billing/* routes (those must stay open
// so admins can fix the billing situation).
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLockoutReason } from '@/lib/billing-access'
import type { Organization } from '@/types'

const LOCKOUT_MESSAGES: Record<string, string> = {
  payment_failed: 'Your payment failed and the grace period has ended. Update your payment method at /settings/billing to restore write access.',
  trial_expired:  'Your free trial has ended. Choose a plan at /settings/billing to restore write access.',
}

/**
 * Checks whether the org has active billing.
 * Returns a 402 NextResponse if locked, null if OK.
 *
 * @param organizationId  - from requireAuth caller
 * @param adminClient     - optional; pass in if you already have one to avoid double-init
 */
export async function requireActiveBilling(
  organizationId: string | null | undefined,
  adminClient?: ReturnType<typeof createAdminClient>
): Promise<NextResponse | null> {
  if (!organizationId) return null   // no org = no billing check needed

  const admin = adminClient ?? createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, subscription_status, subscription_tier, trial_ends_at, grace_period_ends_at')
    .eq('id', organizationId)
    .maybeSingle()

  const reason = getLockoutReason(org as Organization | null)
  if (!reason) return null

  return NextResponse.json(
    {
      error:   LOCKOUT_MESSAGES[reason] ?? 'Account access restricted.',
      code:    'BILLING_LOCKOUT',
      reason,
      billing_url: '/settings/billing',
    },
    { status: 402 }
  )
}
