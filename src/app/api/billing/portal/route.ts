// ============================================================
// POST /api/billing/portal
// Opens the Stripe Customer Portal so users can:
// - Update payment method
// - Cancel or change plan
// - Download invoices
// ============================================================
import { APP_URL } from '@/env'
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    // ── Billing admin check ────────────────────────────────────
    if (caller.role !== 'administrator' && caller.role !== 'organization_owner' && caller.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Only administrators can manage billing.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', caller.organization_id!)
      .maybeSingle()

    if (!org?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found. Please subscribe to a plan first.' },
        { status: 400 }
      )
    }

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer:   org.stripe_customer_id,
      return_url: `${APP_URL}/settings/billing`,
    })

    return NextResponse.json({ url: portalSession.url })

  } catch (err) {
    console.error('[/api/billing/portal]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
