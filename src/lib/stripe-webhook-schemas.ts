// Zod schemas for every Stripe webhook event we handle.
// All webhook payloads MUST be parsed through these before use.
// Unknown fields are stripped (not rejected) to handle Stripe adding new fields.
// Missing required fields → parse failure → 400 (or 200 + dead-letter for webhooks).
import { z } from 'zod'

// Stripe subscription object (subset we use)
const StripeSubscriptionSchema = z.object({
  id: z.string(),
  customer: z.string(),
  status: z.string(),
  trial_end: z.number().nullable().optional(),
  current_period_end: z.number().optional(),
  items: z.object({
    data: z.array(z.object({
      price: z.object({
        id: z.string(),
      }),
    })),
  }).optional(),
}).passthrough()  // allow unknown fields from Stripe

// Stripe invoice object (subset we use)
const StripeInvoiceSchema = z.object({
  id: z.string(),
  customer: z.string(),
  subscription: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  amount_due: z.number().int(),       // integer minor units — enforced here
  amount_paid: z.number().int(),
  currency: z.string(),
}).passthrough()

// Stripe webhook event wrapper
export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number().int(),
  data: z.object({
    object: z.record(z.unknown()),  // we parse the inner object per event type
  }),
  livemode: z.boolean(),
}).passthrough()

export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>

// Per-event data parsers
export function parseSubscriptionEvent(data: unknown) {
  return StripeSubscriptionSchema.safeParse(data)
}

export function parseInvoiceEvent(data: unknown) {
  return StripeInvoiceSchema.safeParse(data)
}

// Subscription status mapping: Stripe status → our DB status
export const STRIPE_STATUS_MAP: Record<string, string> = {
  trialing:  'trialing',
  active:    'active',
  past_due:  'past_due',
  canceled:  'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  unpaid:    'past_due',
  paused:    'past_due',
}

// Dead-letter log for malformed webhooks
// (we return 200 so Stripe doesn't retry our validation bug)
export function deadLetterLog(eventId: string, error: string, rawBody: string) {
  console.error(JSON.stringify({
    type: 'WEBHOOK_DEAD_LETTER',
    eventId,
    error,
    rawBodyPreview: rawBody.slice(0, 200),
    timestamp: new Date().toISOString(),
  }))
}
