// ============================================================
// Stripe Server Client
// ONLY imported in server-side code (API routes).
// Never expose STRIPE_SECRET_KEY to the browser.
//
// The client is created lazily (via getStripe()) so that
// missing env vars throw at request time with a clear message,
// not at build time when the key may not be available.
// ============================================================
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      '[PipeField OS] STRIPE_SECRET_KEY is not set.\n' +
      'Add it to .env.local (dev) or your Vercel project settings (prod).\n' +
      'Found in Stripe Dashboard → Developers → API keys → Secret key.'
    )
  }

  _stripe = new Stripe(key)
  return _stripe
}

// ── Named stripe export (alias for getStripe()) ─────────────
// Some route handlers import { stripe } directly. This satisfies
// that pattern without duplicating the lazy-init logic.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ── Pricing plans ────────────────────────────────────────────
// Price IDs come from your Stripe Dashboard → Products.
// Set these as environment variables in Vercel.
export const PLANS = {
  field_pro: {
    name:        'Field Pro',
    description: 'For solo field workers — 1 user',
    price:       19.99,
    interval:    'month' as const,
    seatLimit:   1,
    // TODO: Add annual price ($99/yr) when annual billing is implemented.
    // priceIdAnnual: process.env.STRIPE_PRICE_FIELD_PRO_ANNUAL ?? '',
    features: [
      'Offset & take-off calculators',
      'Mobile app access',
      'Daily log — PDF + CSV export',
      'Personal project history',
      '1 user, no seat sharing',
    ],
    priceId: process.env.STRIPE_PRICE_FIELD_PRO_MONTHLY ?? '',
    tier:    'field_pro' as const,
  },
  starter: {
    name:        'Starter',
    description: 'For small crews — up to 3 users',
    price:       59.99,
    interval:    'month' as const,
    features: [
      'Up to 3 users',
      'Unlimited projects',
      'Weld & spool tracking',
      'QR code stickers',
      'CSV / PDF reports',
      'Email support',
    ],
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    tier:    'starter' as const,
  },
  professional: {
    name:        'Professional',
    description: 'For growing teams — up to 15 users',
    price:       299.99,
    interval:    'month' as const,
    features: [
      'Up to 15 users',
      'Everything in Starter',
      'NDE inspection tracking',
      'Welder certification management',
      'Advanced analytics',
      'Priority email support',
    ],
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    tier:    'professional' as const,
  },
  enterprise: {
    name:        'Enterprise',
    description: 'Unlimited users, dedicated support',
    price:       999,
    interval:    'month' as const,
    features: [
      'Unlimited users',
      'Everything in Professional',
      'Custom integrations',
      'SSO / SAML',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    tier:    'enterprise' as const,
  },
} as const

export type PlanKey = keyof typeof PLANS

