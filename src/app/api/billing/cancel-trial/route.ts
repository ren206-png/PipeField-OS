// ============================================================
// POST /api/billing/cancel-trial
// Self-serve cancel for a trialing subscription.
//
// Sets cancel_at_period_end: true on the Stripe subscription
// (trial runs to end but does not convert to paid).
// Updates organizations.subscription_status = 'canceled'.
//
// Returns { canceled_at, trial_ends_at } so the UI can
// show a "your trial ends on X" message.
//
// Guards:
//  - requireAuth
//  - TRIAL_BILLING_ENABLED flag
//  - administrator/organization_owner/platform_admin only
//  - org must be in 'trialing' status (not already canceled/active)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/api-auth'
import { TRIAL_BILLING_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── Feature gate ───────────────────────────────────────────
  if (!TRIAL_BILLING_ENABLED) {
    return NextResponse.json({ error: 'Trial billing is not enabled.' }, { status: 503 })
  }

  try {
    // ── Auth ───────────────────────────────────────────────────
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    // ── Role check ─────────────────────────────────────────────
    const adminRoles = ['administrator', 'organization_owner', 'platform_admin']
    if (!adminRoles.includes(caller.role)) {
      return NextResponse.json(
        { error: 'Only administrators can cancel a trial.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    // ── Load org ───────────────────────────────────────────────
    const { data: org } = await admin
      .from('organizations')
      .select('id, stripe_subscription_id, subscription_status, trial_ends_at')
      .eq('id', caller.organization_id!)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
    }

    if (!org.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found.' },
        { status: 400 }
      )
    }

    if (org.subscription_status !== 'trialing') {
      return NextResponse.json(
        { error: `Cannot cancel: subscription is ${org.subscription_status}, not trialing.` },
        { status: 409 }
      )
    }

    // ── Cancel at period end on Stripe ─────────────────────────
    // cancel_at_period_end: true lets the trial run its remaining
    // days without converting to a paid subscription.
    const subscription = await getStripe().subscriptions.update(
      org.stripe_subscription_id,
      { cancel_at_period_end: true }
    )

    const canceledAt  = new Date().toISOString()
    const trialEndsAt = org.trial_ends_at
      ?? (subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null)

    // ── Update org in DB ───────────────────────────────────────
    await admin
      .from('organizations')
      .update({
        subscription_status: 'canceled',
        updated_at: canceledAt,
      })
      .eq('id', org.id)

    return NextResponse.json({
      canceled_at:   canceledAt,
      trial_ends_at: trialEndsAt,
    })

  } catch (err) {
    console.error('[/api/billing/cancel-trial]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
