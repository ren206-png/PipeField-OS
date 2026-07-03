// ============================================================
// Plan tier definitions for PipeField OS
// Price IDs are pulled from environment variables and must be
// configured in Stripe Dashboard → Products.
// ============================================================

export const PLANS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    price: 49,
    interval: 'month' as const,
    limits: { projects: 3, users: 5, welds: 500 },
    features: ['Basic QC tracking', 'PDF exports', '5 users'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    price: 149,
    interval: 'month' as const,
    limits: { projects: 20, users: 25, welds: 10000 },
    features: ['Everything in Starter', 'NDE tracker', 'Daily email digest', '25 users'],
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    price: 499,
    interval: 'month' as const,
    limits: { projects: Infinity, users: Infinity, welds: Infinity },
    features: ['Unlimited everything', 'Priority support', 'Custom integrations'],
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
