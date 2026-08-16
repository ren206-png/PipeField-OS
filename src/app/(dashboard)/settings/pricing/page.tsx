'use client'
// In-dashboard pricing page — shows current plan + upgrade CTAs
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'

interface PlanCard {
  key: string
  name: string
  price: string
  period: string
  description: string
  features: Array<{ text: string; isNew?: boolean }>
  popular?: boolean
}

const PLANS: PlanCard[] = [
  {
    key: 'field_pro',
    name: 'Field Pro',
    price: '$19.99',
    period: '/mo',
    description: 'For the solo welder or inspector working in the field.',
    features: [
      { text: 'Offset & take-off calculators' },
      { text: 'Mobile app access' },
      { text: 'Daily log — PDF + CSV export' },
      { text: 'Personal project history' },
      { text: '1 user, no seat sharing' },
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$59.99',
    period: '/mo',
    description: 'Small crews ready to bring tracking in-house.',
    features: [
      { text: 'Up to 3 users' },
      { text: 'Unlimited projects' },
      { text: 'Weld & spool tracking' },
      { text: 'QR code stickers' },
      { text: 'CSV / PDF reports' },
      { text: 'Email support' },
      { text: 'AWS D1.1 compliance templates', isNew: true },
      { text: 'Welder continuity (180-day tracking)', isNew: true },
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: '$299.99',
    period: '/mo',
    description: 'Growing shops that need ERP sync and compliance tooling.',
    features: [
      { text: 'Up to 15 users' },
      { text: 'Everything in Starter' },
      { text: 'NDE inspection tracking' },
      { text: 'Welder cert management' },
      { text: 'Advanced analytics' },
      { text: 'Priority support' },
      { text: 'ERP integration (MIE Trak, Syspro)', isNew: true },
      { text: 'Inspection records & NDT workflow', isNew: true },
      { text: 'Audit pack export', isNew: true },
      { text: 'Compliance dashboard', isNew: true },
    ],
    popular: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$999',
    period: '/mo',
    description: 'Large contractors with custom ERP needs and unlimited scale.',
    features: [
      { text: 'Unlimited users' },
      { text: 'Everything in Professional' },
      { text: 'Custom ERP connectors', isNew: true },
      { text: 'Unlimited compliance standards', isNew: true },
      { text: 'SSO / SAML' },
      { text: 'Dedicated account manager' },
      { text: 'SLA guarantee' },
    ],
  },
]

export default function DashboardPricingPage() {
  const { organization } = useOrganization()
  const currentTier = organization?.subscription_tier ?? null

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Pricing</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Simple, transparent pricing. Built for the field.
        </p>
      </div>

      {/* Current plan note */}
      {currentTier && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
          Your current plan is highlighted below. To change your plan, visit{' '}
          <Link href="/settings/billing" className="underline underline-offset-2 hover:text-brand-200">
            Billing Settings
          </Link>
          .
        </div>
      )}

      {/* Plan grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.key
          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border bg-surface-800/50 p-6 flex flex-col ${
                isCurrent
                  ? 'border-green-500 ring-1 ring-green-500/30'
                  : plan.popular
                  ? 'border-brand-500 ring-1 ring-brand-500/20'
                  : 'border-surface-700'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Current Plan
                  </span>
                </div>
              )}
              {!isCurrent && plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-lg font-bold text-surface-50">{plan.name}</h2>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-surface-50">{plan.price}</span>
                  <span className="text-surface-400 text-sm mb-1">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-surface-400">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-surface-200">
                      {f.text}
                      {f.isNew && (
                        <span className="ml-1.5 inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 leading-none align-middle">
                          New
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="block text-center rounded-xl py-2.5 px-4 text-sm font-semibold bg-green-500/15 border border-green-500/30 text-green-400">
                  Your Plan
                </span>
              ) : (
                <Link
                  href="/settings/billing"
                  className={`block text-center rounded-xl py-2.5 px-4 text-sm font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-brand-500 hover:bg-brand-400 text-white'
                      : 'bg-surface-700 hover:bg-surface-600 text-surface-100'
                  }`}
                >
                  Upgrade
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-sm text-surface-500 pb-4">
        All plans include 14-day free trial · Secured by Stripe · Cancel anytime
      </p>
    </div>
  )
}
