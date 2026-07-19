// ============================================================
// Plan tier definitions for PipeField OS
// Price IDs are pulled from environment variables and must be
// configured in Stripe Dashboard → Products.
// ============================================================

export const PLANS = {
  field_pro: {
    name:     'Field Pro',
    priceId:  process.env.STRIPE_PRICE_FIELD_PRO ?? '',
    price:    19.99,
    interval: 'month' as const,
    limits:   { projects: 1, users: 1, welds: 500 },
    features: [
      'Offset & take-off calculators',
      'Mobile app access',
      'Daily log — PDF + CSV export',
      'Personal project history',
      '1 user, no seat sharing',
    ],
  },
  starter: {
    name:     'Starter',
    priceId:  process.env.STRIPE_PRICE_STARTER ?? '',
    price:    59.99,
    interval: 'month' as const,
    limits:   { projects: Infinity, users: 3, welds: 5000 },
    features: [
      'Up to 3 users',
      'Unlimited projects',
      'Weld & spool tracking',
      'QR code stickers',
      'CSV / PDF reports',
      'Email support',
    ],
  },
  professional: {
    name:     'Professional',
    priceId:  process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    price:    299.99,
    interval: 'month' as const,
    limits:   { projects: Infinity, users: 15, welds: Infinity },
    features: [
      'Up to 15 users',
      'Everything in Starter',
      'NDE inspection tracking',
      'Welder cert management',
      'Advanced analytics',
      'Priority support',
    ],
  },
  enterprise: {
    name:     'Enterprise',
    priceId:  process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    price:    999,
    interval: 'month' as const,
    limits:   { projects: Infinity, users: Infinity, welds: Infinity },
    features: [
      'Unlimited users',
      'Everything in Professional',
      'Custom integrations',
      'SSO / SAML',
      'Dedicated account manager',
      'SLA guarantee',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

// ── Plan limit helpers ────────────────────────────────────────

export function getPlanLimits(plan: string) {
  const key = (plan in PLANS ? plan : 'starter') as PlanKey
  return PLANS[key].limits
}

export function isWithinLimit(current: number, limit: number): boolean {
  return limit === Infinity || current < limit
}

export function limitLabel(limit: number | null): string {
  if (limit === null || limit === Infinity) return 'Unlimited'
  return String(limit)
}
