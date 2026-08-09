'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CreditCard, CheckCircle2, AlertCircle, Zap,
  ArrowRight, Loader2, ExternalLink, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { BillingStatusBanner } from '@/components/billing/BillingStatusBanner'
import { TrialSignupCard } from '@/components/billing/TrialSignupCard'
import type { PlanKey } from '@/lib/plans'
import { apiFetch } from '@/lib/apiFetch'

// ── Plan definitions (mirrors src/lib/stripe.ts — client-safe, no secret) ──
const PLANS = [
  {
    key:         'field_pro',
    name:        'Field Pro',
    price:       19.99,
    description: 'For solo field workers',
    badge:       'For solo field workers',
    headline:    'Stop doing layout math on cardboard.',
    body:        'Built for pipefitters who work alone. Run offset and take-off calculations on your phone, log your day, and export your records — no team required.',
    features: [
      'Offset & take-off calculators',
      'Mobile app access',
      'Daily log — PDF + CSV export',
      'Personal project history',
      '1 user, no seat sharing',
    ],
    highlight: false,
  },
  {
    key:         'starter',
    name:        'Starter',
    price:       59.99,
    description: 'For small crews',
    badge:       null,
    headline:    null,
    body:        null,
    features: [
      'Up to 3 users',
      'Unlimited projects',
      'Weld & spool tracking',
      'QR code stickers',
      'CSV / PDF reports',
      'Email support',
    ],
    highlight: false,
  },
  {
    key:         'professional',
    name:        'Professional',
    price:       299.99,
    description: 'For growing teams',
    badge:       null,
    headline:    null,
    body:        null,
    features: [
      'Up to 15 users',
      'Everything in Starter',
      'NDE inspection tracking',
      'Welder cert management',
      'Advanced analytics',
      'Priority support',
    ],
    highlight: true,
  },
  {
    key:         'enterprise',
    name:        'Enterprise',
    price:       999,
    description: 'Unlimited scale',
    badge:       null,
    headline:    null,
    body:        null,
    features: [
      'Unlimited users',
      'Everything in Professional',
      'Custom integrations',
      'SSO / SAML',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    highlight: false,
  },
]

const TIER_LABELS: Record<string, string> = {
  free_trial:   'Free Trial',
  field_pro:    'Field Pro',
  starter:      'Starter',
  professional: 'Professional',
  enterprise:   'Enterprise',
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-500/15 text-green-400',
  trialing: 'bg-brand-500/15 text-brand-300',
  past_due: 'bg-orange-500/15 text-orange-400',
  canceled: 'bg-danger/15 text-red-400',
  paused:   'bg-surface-700 text-surface-400',
}

function BillingContent() {
  const { profile }      = useAuth()
  const { organization } = useOrganization()
  const searchParams     = useSearchParams()

  const [loadingPlan,   setLoadingPlan]   = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  const successParam      = searchParams.get('success')
  const cancelParam       = searchParams.get('canceled')
  const trialStartedParam = searchParams.get('trial_started')
  const trialCanceledParam= searchParams.get('trial_canceled')
  const planParam         = searchParams.get('plan')

  const isAdmin       = profile?.role === 'administrator'
                     || profile?.role === 'organization_owner'
                     || profile?.role === 'platform_admin'
  const currentTier   = organization?.subscription_tier   ?? 'free_trial'
  const currentStatus = organization?.subscription_status ?? 'trialing'

  // Clear search params after reading them (clean URL)
  useEffect(() => {
    if (successParam || cancelParam || trialStartedParam || trialCanceledParam) {
      window.history.replaceState({}, '', '/settings/billing')
    }
  }, [successParam, cancelParam, trialStartedParam, trialCanceledParam])

  async function handleSubscribe(planKey: string) {
    if (!isAdmin) return
    setLoadingPlan(planKey)
    setError(null)
    try {
      const res = await apiFetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planKey }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Checkout failed')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoadingPlan(null)
    }
  }

  async function handlePortal() {
    setLoadingPortal(true)
    setError(null)
    try {
      const res = await apiFetch('/api/billing/portal', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not open portal')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoadingPortal(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Billing & Subscription</h1>
        <p className="text-sm text-surface-500 mt-1">
          Manage your plan, payment method, and invoices.
        </p>
      </div>

      {/* Success / cancel banners */}
      {successParam && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Subscription activated!</p>
            <p className="text-sm text-green-400/80">
              Welcome to the {planParam ? (TIER_LABELS[planParam] ?? planParam) : ''} plan.
              Your account is now active.
            </p>
          </div>
        </div>
      )}
      {trialStartedParam && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-brand-400" />
          <div>
            <p className="font-semibold">Trial started!</p>
            <p className="text-sm text-brand-300/80">
              Your 14-day free trial is active. You won&apos;t be charged until it ends.
            </p>
          </div>
        </div>
      )}
      {(cancelParam || trialCanceledParam) && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Checkout was cancelled. No charge was made.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Trial status banner (trialing countdown, canceled notice, past_due) */}
      {organization && (
        <BillingStatusBanner
          organization={organization}
          isAdmin={isAdmin}
        />
      )}

      {/* Trial signup card — for orgs with no Stripe subscription yet */}
      {currentTier === 'free_trial' && !organization?.stripe_subscription_id && (
        <TrialSignupCard isAdmin={isAdmin} />
      )}

      {/* Current plan card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/15 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500 uppercase tracking-wide font-semibold mb-1">Current Plan</p>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-surface-50">
                  {TIER_LABELS[currentTier] ?? currentTier}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[currentStatus] ?? STATUS_STYLES.active}`}>
                  {currentStatus.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-surface-500 mt-0.5">{organization?.name}</p>
            </div>
          </div>

          {/* Manage billing button — only shown when customer exists */}
          {isAdmin && currentTier !== 'free_trial' && (
            <button
              onClick={handlePortal}
              disabled={loadingPortal}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              {loadingPortal
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ExternalLink className="w-4 h-4" />
              }
              Manage Billing
            </button>
          )}
        </div>

        {currentStatus === 'past_due' && (
          <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Payment failed. Please update your payment method to keep your account active.
          </div>
        )}
      </div>

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-400 text-sm">
          Only the organization administrator can manage billing.
        </div>
      )}

      {/* Pricing cards */}
      <div>
        <h2 className="text-lg font-bold text-surface-100 mb-4">Choose a Plan</h2>
        {/* 4-card grid: single col → 2×2 at md → 4-col at lg */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => {
            const isCurrent = currentTier === plan.key
            const isLoading = loadingPlan === plan.key
            // field_pro CTA label differs from team plans
            const ctaLabel  = plan.key === 'field_pro' ? 'Get Field Pro' : (currentTier === 'free_trial' ? 'Start Free Trial' : 'Switch Plan')

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                  plan.highlight
                    ? 'border-brand-500/50 bg-brand-500/5 shadow-lg shadow-brand-500/10'
                    : 'border-surface-700 bg-surface-800/50'
                } ${isCurrent ? 'ring-2 ring-brand-500/40' : ''}`}
              >
                {/* Most popular badge — Professional only, unchanged */}
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-brand-500 text-white text-xs font-bold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Field Pro "For solo field workers" badge */}
                {plan.badge && !plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="px-3 py-1 rounded-full bg-surface-600 text-surface-300 text-xs font-semibold border border-surface-500">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Current
                    </span>
                  </div>
                )}

                {/* Plan info */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-surface-50">{plan.name}</h3>
                  <p className="text-sm text-surface-500">{plan.description}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-surface-50">${plan.price}</span>
                    <span className="text-surface-500 text-sm">/month</span>
                  </div>
                  {/* Field Pro copy block */}
                  {plan.headline && (
                    <p className="mt-3 text-sm font-semibold text-surface-200">{plan.headline}</p>
                  )}
                  {plan.body && (
                    <p className="mt-1 text-xs text-surface-500 leading-relaxed">{plan.body}</p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-surface-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA — exact same class pattern as before; no new variants */}
                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={!isAdmin || isCurrent || isLoading}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                    isCurrent
                      ? 'bg-surface-700 text-surface-400 cursor-default'
                      : plan.highlight
                        ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-glow disabled:opacity-50'
                        : 'bg-surface-700 hover:bg-surface-600 text-surface-100 disabled:opacity-50'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    <>
                      {ctaLabel}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-surface-600 mt-4 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secured by Stripe · Cancel anytime · 14-day free trial on all plans
        </p>
      </div>

      {/* FAQ */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-surface-100">Frequently Asked Questions</h3>
        {[
          {
            q: 'Can I cancel anytime?',
            a: 'Yes. Cancel from the Manage Billing portal. Your plan stays active until the end of the billing period.',
          },
          {
            q: 'What happens when my trial ends?',
            a: 'You\'ll be prompted to choose a plan. Your data is never deleted — you\'ll just lose write access until you subscribe.',
          },
          {
            q: 'Can I switch plans mid-cycle?',
            a: 'Yes. Upgrades are prorated immediately. Downgrades take effect at the next billing cycle.',
          },
          {
            q: 'Do you offer annual pricing?',
            a: 'Yes — annual plans save 20%. Contact us at billing@pipefield.app to switch.',
          },
        ].map(item => (
          <div key={item.q} className="border-b border-surface-700 last:border-0 pb-4 last:pb-0">
            <p className="text-sm font-medium text-surface-200">{item.q}</p>
            <p className="text-sm text-surface-400 mt-1">{item.a}</p>
          </div>
        ))}
      </div>

    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="text-surface-500 text-sm p-8">Loading billing…</div>}>
      <BillingContent />
    </Suspense>
  )
}
