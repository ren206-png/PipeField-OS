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
import { logger } from '@/lib/logger'
import {
  StripeWebhookEventSchema,
  parseSubscriptionEvent,
  parseInvoiceEvent,
  deadLetterLog,
  STRIPE_STATUS_MAP,
} from '@/lib/stripe-webhook-schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  logger.warn('billing.webhook.unknown_price', { priceId })
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
    trial_ends_at?:              string
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
  if (error) logger.error('billing.webhook.update_org_failed', new Error(error.message))
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
    logger.error('billing.webhook.signature_failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Zod-validate the outer event envelope ─────────────────────
  const eventParse = StripeWebhookEventSchema.safeParse(event)
  if (!eventParse.success) {
    deadLetterLog(
      (event as { id?: string }).id ?? 'unknown',
      eventParse.error.message,
      body
    )
    // Return 200 so Stripe doesn't retry our validation bug
    return NextResponse.json({ received: true, warning: 'DEAD_LETTER' })
  }
  const validatedEvent = eventParse.data

  try {
    switch (validatedEvent.type) {

      case 'checkout.session.completed': {
        const session = validatedEvent.data.object as unknown as Stripe.Checkout.Session
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
              logger.error('billing.webhook.event_handler_failed', new Error(`field_pro checkout rejected for org ${orgId}: ${count} active seats exceed the 1-seat limit. Cancelling subscription ${subscriptionId}.`))
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
        // ── Zod-parse the subscription object ─────────────────────
        const subParse = parseSubscriptionEvent(validatedEvent.data.object)
        if (!subParse.success) {
          deadLetterLog(validatedEvent.id, subParse.error.message, body)
          return NextResponse.json({ received: true, warning: 'DEAD_LETTER' })
        }
        const subData    = subParse.data
        const customerId = subData.customer
        const priceId    = subData.items?.data[0]?.price.id ?? ''
        const periodEnd  = subData.current_period_end ?? 0
        const tier2      = tierFromPriceId(priceId)
        const dbStatus2  = STRIPE_STATUS_MAP[subData.status] ?? 'incomplete'

        if (tier2) {
          const updatePayload2: Parameters<typeof updateOrg>[1] = {
            subscription_tier:         tier2,
            subscription_status:       dbStatus2,
            stripe_subscription_id:    subData.id,
            stripe_current_period_end: new Date(periodEnd * 1000).toISOString(),
          }
          // If trial_end is present, update trial_ends_at
          if (subData.trial_end) {
            updatePayload2.trial_ends_at = new Date(subData.trial_end * 1000).toISOString()
          }
          await updateOrg(customerId, updatePayload2)
        }
        break
      }

      case 'customer.subscription.deleted': {
        // ── Zod-parse the subscription object ─────────────────────
        const subParse = parseSubscriptionEvent(validatedEvent.data.object)
        if (!subParse.success) {
          deadLetterLog(validatedEvent.id, subParse.error.message, body)
          return NextResponse.json({ received: true, warning: 'DEAD_LETTER' })
        }
        const subData    = subParse.data
        const customerId = subData.customer

        // On full deletion (trial or paid), downgrade to free_trial tier,
        // clear grace window and trial timestamp.
        const adminDel = createAdminClient()
        await adminDel
          .from('organizations')
          .update({
            subscription_tier:    'free_trial',
            subscription_status:  'canceled',
            grace_period_ends_at: null,
            trial_ends_at:        null,
            updated_at:           new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'invoice.payment_succeeded': {
        // ── Zod-parse the invoice object ──────────────────────────
        const invParse = parseInvoiceEvent(validatedEvent.data.object)
        if (!invParse.success) {
          deadLetterLog(validatedEvent.id, invParse.error.message, body)
          return NextResponse.json({ received: true, warning: 'DEAD_LETTER' })
        }
        const invoiceData = invParse.data
        const customerId  = invoiceData.customer
        const subId       = invoiceData.subscription ?? undefined

        if (subId) {
          const sub     = await getStripe().subscriptions.retrieve(subId)
          const priceId = sub.items.data[0]?.price.id ?? ''
          const periodEnd = getPeriodEnd(sub)
          const tier3 = tierFromPriceId(priceId)

          // Reactivation: clear grace_period_ends_at and trial_ends_at,
          // mark subscription active. This fires on:
          //   - Trial-to-paid conversion (first charge after trial)
          //   - Dunning recovery (payment retried + succeeded)
          //   - Normal monthly renewal
          const adminClient = createAdminClient()
          await adminClient
            .from('organizations')
            .update({
              subscription_status:       'active',
              grace_period_ends_at:      null,
              trial_ends_at:             null,
              ...(tier3 ? { subscription_tier: tier3 } : {}),
              stripe_current_period_end: new Date(periodEnd * 1000).toISOString(),
              updated_at:                new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId)

          // In-app notification: subscription is now active
          // (skip if this is just a normal renewal — only fire on recovery)
          const { data: orgRow } = await adminClient
            .from('organizations')
            .select('id, subscription_status')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()

          if (orgRow) {
            // Insert reactivation notification — fire-and-forget, never throw
            void Promise.resolve(
              adminClient.from('notifications').insert({
                organization_id: orgRow.id,
                user_id:         null,
                type:            'billing_reactivated',
                title:           '✅ Subscription reactivated',
                body:            'Your payment went through. Full access has been restored.',
                href:            '/settings/billing',
                is_read:         false,
              })
            ).catch(() => {})
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        // ── Zod-parse the invoice object ──────────────────────────
        const invParse = parseInvoiceEvent(validatedEvent.data.object)
        if (!invParse.success) {
          deadLetterLog(validatedEvent.id, invParse.error.message, body)
          return NextResponse.json({ received: true, warning: 'DEAD_LETTER' })
        }
        const invoiceData = invParse.data
        const customerId  = invoiceData.customer

        // 3-day grace period from first failure.
        // Only set grace_period_ends_at if not already set (idempotent —
        // Stripe retries payment_failed multiple times during dunning).
        const adminClient2   = createAdminClient()
        const { data: orgRow2 } = await adminClient2
          .from('organizations')
          .select('id, grace_period_ends_at')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        const graceEnds = orgRow2?.grace_period_ends_at
          ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

        await adminClient2
          .from('organizations')
          .update({
            subscription_status:  'past_due',
            grace_period_ends_at: graceEnds,  // idempotent: keep original if set
            updated_at:           new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        // In-app notification for payment failure
        if (orgRow2) {
          void Promise.resolve(
            adminClient2.from('notifications').insert({
              organization_id: orgRow2.id,
              user_id:         null,
              type:            'payment_failed',
              title:           '⚠️ Payment failed',
              body:            'We couldn\'t charge your card. Update your payment method to keep full access.',
              href:            '/settings/billing',
              is_read:         false,
            })
          ).catch(() => {})
        }
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    logger.error('billing.webhook.handler_failed', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
