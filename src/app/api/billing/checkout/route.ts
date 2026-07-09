// ============================================================
// POST /api/billing/checkout
// Creates a Stripe Checkout session for plan upgrades.
// Redirects user to Stripe-hosted payment page.
// ============================================================
import { APP_URL } from '@/env'
import { NextRequest, NextResponse } from 'next/server'
import { getStripe, PLANS } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  planKey: z.enum(['field_pro', 'starter', 'professional', 'enterprise']),
})

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    // ── Validate body ──────────────────────────────────────────
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    const { planKey } = parsed.data
    const plan = PLANS[planKey]

    const envVarNames: Record<string, string> = {
      field_pro:    'STRIPE_PRICE_FIELD_PRO_MONTHLY',
      starter:      'STRIPE_PRICE_STARTER',
      professional: 'STRIPE_PRICE_PROFESSIONAL',
      enterprise:   'STRIPE_PRICE_ENTERPRISE',
    }
    if (!plan.priceId) {
      return NextResponse.json(
        { error: `${envVarNames[planKey] ?? `STRIPE_PRICE_${planKey.toUpperCase()}`} env var is not set.` },
        { status: 500 }
      )
    }

    // ── Billing admin check ────────────────────────────────────
    // field_pro is an individual plan — any authenticated user can purchase it
    // for themselves. Team plans still require administrator / org owner.
    const isFieldPro = planKey === 'field_pro'
    if (!isFieldPro) {
      if (caller.role !== 'administrator' && caller.role !== 'organization_owner' && caller.role !== 'platform_admin') {
        return NextResponse.json(
          { error: 'Only administrators can manage billing.' },
          { status: 403 }
        )
      }
    }

    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', caller.organization_id!)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // ── Get or create Stripe customer ─────────────────────────
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

    // ── Create checkout session ───────────────────────────────
    const session = await getStripe().checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${APP_URL}/settings/billing?success=true&plan=${planKey}`,
      cancel_url:  `${APP_URL}/settings/billing?canceled=true`,
      metadata:    { org_id: org.id, plan: planKey },
      subscription_data: {
        metadata: { org_id: org.id, plan: planKey },
        trial_period_days: 14,
      },
      allow_promotion_codes:      true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url })

  } catch (err) {
    console.error('[/api/billing/checkout]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
