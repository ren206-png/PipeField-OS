// ============================================================
// POST /api/billing/webhook
// Receives Stripe events and keeps the database in sync.
//
// Register in Stripe Dashboard → Webhooks → Add endpoint:
//   URL:    https://pipefield-os.vercel.app/api/billing/webhook
//   Events: checkout.session.completed
//           customer.subscription.created
//           customer.subscription.updated
//           customer.subscription.deleted
//           invoice.payment_succeeded
//           invoice.payment_failed
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function mapStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active:             'active',
    trialing:           'trialing',
    past_due:           'past_due',
    canceled:           'canceled',
    unpaid:             'past_due',
    incomplete:         'past_due',
    incomplete_expired: 'canceled',
    paused:             'paused',
  }
  return map[stripeStatus] ?? 'active'
}

// ── Stripe field accessors ────────────────────────────────────
// `current_period_end` and `subscription` exist on the Stripe objects
// at runtime but sit on a version-gated interface in the SDK types.
// These helpers extract them without propagating `any` further.
function getPeriodEnd(sub: Stripe.Subscription): number {
  return (sub as Stripe.Subscription & { current_period_end: number }).current_period_end
}
function getInvoiceSubId(invoice: Stripe.Invoice): string | undefined {
  return (invoice as Stripe.Invoice & { subscription?: string }).subscription
}

function tierFromPriceId(priceId: string): string | null {
  if (priceId === process.env.STRIPE_PRICE_FIELD_PRO_MONTHLY) return 'field_pro'
  if (priceId === process.env.STRIPE_PRICE_STARTER)           return 'starter'
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL)      return 'professional'
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE)        return 'enterprise'
  // Unknown price ID — log a warning and leave the tier unchanged (return null).
  // Previously this silently fell back to 'starter' which could downgrade a paid org.
  console.warn(`[webhook] Unknown price ID: ${priceId} — tier not updated`)
  return null
}

/** Returns true when the Stripe price belongs to the field_pro plan */
function isFieldProPrice(priceId: string): boolean {
  return priceId === process.env.STRIPE_PRICE_FIELD_PRO_MONTHLY
}

async function updateOrg(
  customerId: string,
  updates: {
    subscription_tier?:          string
    subscription_status?:        string
    stripe_subscription_id?:     string
    stripe_current_period_end?:  string
    seat_limit?:                 number | null
  }
) {
  // Automatically sync seat_limit whenever subscription_tier changes
  const payload = { ...updates, updated_at: new Date().toISOString() }
  if (updates.subscription_tier !== undefined && !('seat_limit' in updates)) {
    payload.seat_limit = updates.subscription_tier === 'field_pro' ? 1 : null
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update(payload)
    .eq('stripe_customer_id', customerId)
  if (error) console.error('[webhook] updateOrg failed:', error.message)
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const subscriptionId = session.subscription as string
        const customerId     = session.customer as string
        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const priceId   = sub.items.data[0]?.price.id ?? ''
        const periodEnd = getPeriodEnd(sub)

        // ── Field Pro seat-count guard ───────────────────────────
        // field_pro is a 1-seat plan. If the org completing checkout
        // already has more than 1 active user, reject and cancel the
        // subscription rather than silently activating a misconfigured account.
        if (isFieldProPrice(priceId)) {
          const orgId = session.metadata?.org_id as string | undefined
          if (orgId) {
            const admin = createAdminClient()
            const { count } = await admin
              .from('user_profiles')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', orgId)
              .eq('is_active', true)

            if ((count ?? 0) > 1) {
              console.error(
                `[webhook] field_pro checkout rejected for org ${orgId}: ` +
                `${count} active seats exceed the 1-seat limit. ` +
                `Cancelling subscription ${subscriptionId}.`
              )
              await getStripe().subscriptions.cancel(subscriptionId)
              break
            }
          }
        }

        const tier = tierFromPriceId(priceId)
        if (tier) {
          await updateOrg(customerId, {
            subscription_tier:         tier,
            subscription_status:       mapStatus(sub.status),
            stripe_subscription_id:    subscriptionId,
            stripe_current_period_end: new Date(periodEnd * 1000).toISOString(),
          })
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId    = sub.items.data[0]?.price.id ?? ''
        const periodEnd  = (sub as unknown as { current_period_end: number }).current_period_end
        const tier2      = tierFromPriceId(priceId)

        if (tier2) {
          await updateOrg(customerId, {
            subscription_tier:         tier2,
            subscription_status:       mapStatus(sub.status),
            stripe_subscription_id:    sub.id,
            stripe_current_period_end: new Date(periodEnd * 1000).toISOString(),
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        await updateOrg(customerId, {
          subscription_tier:   'free_trial',
          subscription_status: 'canceled',
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const subId      = getInvoiceSubId(invoice)

        if (subId) {
          const sub     = await getStripe().subscriptions.retrieve(subId)
          const priceId = sub.items.data[0]?.price.id ?? ''
          const periodEnd = getPeriodEnd(sub)
          const tier3 = tierFromPriceId(priceId)
          await updateOrg(customerId, {
            subscription_status:       'active',
            ...(tier3 ? { subscription_tier: tier3 } : {}),
            stripe_current_period_end: new Date(periodEnd * 1000).toISOString(),
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await updateOrg(customerId, { subscription_status: 'past_due' })
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    console.error('[webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
