'use client'
// ============================================================
// TrialSignupCard — shown on the billing page for orgs that
// have no Stripe subscription yet (subscription_tier = 'free_trial'
// AND no stripe_subscription_id).
//
// Presents a 3-card plan selector (Starter / Professional /
// Enterprise) with a single "Start 14-day free trial" CTA that
// calls POST /api/billing/create-trial and redirects to Stripe
// Checkout.
//
// Card collection happens on Stripe's hosted page — we never
// touch card numbers. The card is authorized but NOT charged
// during the trial period.
//
// Only rendered when PFOS_TRIAL_BILLING is enabled.
// ============================================================
import { useState } from 'react'
import { Zap, CheckCircle2, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/apiFetch'

type PlanKey = 'starter' | 'professional' | 'enterprise'

const TRIAL_PLANS: {
  key:      PlanKey
  name:     string
  price:    number
  desc:     string
  features: string[]
  highlight: boolean
}[] = [
  {
    key:      'starter',
    name:     'Starter',
    price:    59.99,
    desc:     'For small crews — up to 3 users',
    features: ['Up to 3 users', 'Unlimited projects', 'Weld & spool tracking', 'CSV / PDF reports'],
    highlight: false,
  },
  {
    key:      'professional',
    name:     'Professional',
    price:    299.99,
    desc:     'For growing teams — up to 15 users',
    features: ['Up to 15 users', 'NDE inspection tracking', 'Welder cert management', 'Advanced analytics'],
    highlight: true,
  },
  {
    key:      'enterprise',
    name:     'Enterprise',
    price:    999,
    desc:     'Unlimited users, dedicated support',
    features: ['Unlimited users', 'Custom integrations', 'SSO / SAML', 'Dedicated account manager'],
    highlight: false,
  },
]

interface Props {
  isAdmin: boolean
}

export function TrialSignupCard({ isAdmin }: Props) {
  const [selected, setSelected] = useState<PlanKey>('professional')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleStartTrial() {
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    try {
      const res  = await apiFetch('/api/billing/create-trial', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planKey: selected }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not start trial')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-surface-50">Start your 14-day free trial</h2>
          <p className="text-sm text-surface-400 mt-0.5">
            Card required to start — you won&apos;t be charged until the trial ends.
            Cancel any time before then.
          </p>
        </div>
      </div>

      {/* Plan selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TRIAL_PLANS.map(plan => {
          const isSelected = selected === plan.key
          return (
            <button
              key={plan.key}
              onClick={() => setSelected(plan.key)}
              className={cn(
                'relative text-left rounded-xl border p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                isSelected
                  ? 'border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10'
                  : 'border-surface-700 bg-surface-800 hover:border-surface-600',
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold whitespace-nowrap">
                  Most Popular
                </span>
              )}
              {isSelected && (
                <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-brand-400" />
              )}
              <p className="font-semibold text-surface-100 text-sm">{plan.name}</p>
              <p className="text-xs text-surface-500 mt-0.5">{plan.desc}</p>
              <p className="mt-2 text-xl font-extrabold text-surface-50">
                ${plan.price}
                <span className="text-xs font-normal text-surface-500">/mo</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-surface-400">
                    <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <span className="font-medium">Error:</span> {error}
        </p>
      )}

      {/* CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={handleStartTrial}
          disabled={!isAdmin || loading}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Zap className="w-4 h-4" />
          }
          {loading ? 'Redirecting…' : `Start free trial — ${TRIAL_PLANS.find(p => p.key === selected)?.name}`}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>

        {!isAdmin && (
          <p className="text-xs text-surface-500">
            Only administrators can start a trial.
          </p>
        )}
      </div>

      <p className="text-xs text-surface-600 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Card secured by Stripe · No charge for 14 days · Cancel before trial ends and pay nothing
      </p>
    </div>
  )
}
