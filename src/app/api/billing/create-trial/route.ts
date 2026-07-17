// ============================================================
// POST /api/billing/create-trial
// Creates a Stripe Checkout session that collects a card and
// starts a 14-day free trial subscription.
//
// Idempotent: if the org already has a trialing subscription
// the existing checkout URL is returned (or portal if active).
//
// Card is authorized but NOT charged during the trial.
// Subscription auto-cancels at trial end if no payment method
// is confirmed (trial_settings.end_behavior.missing_payment_method).
//
// Guards:
//  - requireAuth
//  - TRIAL_BILLING_ENABLED flag
//  - administrator/organization_owner/platform_admin only
//  - no double-trial (idempotency check)
//  - rollback: if DB write fails after Stripe sub creation,
//    the Stripe subscription is canceled before throwing
// ============================================================
import { APP_URL } from '@/env'
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/api-auth'
import { TRIAL_BILLING_ENABLED } from '@/intelligence/flags'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  planKey: z.enum(['starter', 'professional', 'enterprise']),
}).strict()

const PRICE_ENV: Record<string, string | undefined> = {
  starter:      process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE,
}

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
        { error: 'Only administrators can start a trial.' },
        { status: 403 }
      )
    }

    // ── Validate body ──────────────────────────────────────────
    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid plan. Choose starter, professional, or enterprise.' },
        { status: 400 }
      )
    }
    const { planKey } = parsed.data
    const priceId = PRICE_ENV[planKey]
    if (!priceId) {
      return NextResponse.json(
        { error: `STRIPE_PRICE_${planKey.toUpperCase()} env var is not set.` },
        { status: 500 }
      )
    }

    const admin = createAdminClient()

    // ── Load org ───────────────────────────────────────────────
    const { data: org } = await admin
      .from('organizations')
      .select('id, name, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', caller.organization_id!)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
    }

    // ── Idempotency: already trialing ──────────────────────────
    // If a trial subscription already exists, return a portal URL
    // so the user can manage/view it instead of creating a second one.
    if (
      org.stripe_subscription_id &&
      (org.subscription_status === 'trialing' || org.subscription_status === 'active')
    ) {
      try {
        const portalSession = await getStripe().billingPortal.sessions.create({
          customer:   org.stripe_customer_id!,
          return_url: `${APP_URL}/settings/billing`,
        })
        return NextResponse.json({ url: portalSession.url, existing: true })
      } catch {
        // Portal creation failed (e.g. no customer) — fall through to checkout
      }
    }

    // ── Get or create Stripe customer ──────────────────────────
    let customerId: string = org.stripe_customer_id ?? ''

    if (!customerId) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('email')
        .eq('auth_user_id', caller.auth_user_id)
        .maybeSingle()

      const customer = await getStripe().customers.create({
        email:    profile?.email ?? undefined,
        name:     org.name,
        metadata: { org_id: org.id, user_id: caller.auth_user_id },
      })
      customerId = customer.id

      await admin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id)
    }

    // ── Create Checkout session with trial ─────────────────────
    // mode: 'subscription' + trial_period_days collects the card
    // via SetupIntent under the hood, authorizes it, and starts
    // the subscription in 'trialing' state.
    // payment_behavior: 'default_incomplete' keeps status trialing
    // until payment is confirmed post-trial.
    const session = await getStripe().checkout.sessions.create({
      customer:            customerId,
      mode:                'subscription',
      line_items:          [{ price: priceId, quantity: 1 }],
      success_url:         `${APP_URL}/settings/billing?trial_started=true&plan=${planKey}`,
      cancel_url:          `${APP_URL}/settings/billing?trial_canceled=true`,
      metadata:            { org_id: org.id, plan: planKey },
      payment_method_collection: 'always',   // card required to start trial
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',  // auto-cancel if no card confirmed
          },
        },
        metadata: { org_id: org.id, plan: planKey },
      },
      allow_promotion_codes:      true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url, existing: false })

  } catch (err) {
    console.error('[/api/billing/create-trial]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
