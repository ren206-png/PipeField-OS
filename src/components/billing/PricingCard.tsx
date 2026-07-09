'use client'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'

interface Props {
  plan: string
  planData: { name: string; price: number; priceId?: string }
  features: string[]
  isCurrentPlan: boolean
  organizationId: string
}

export function PricingCard({ plan, planData, features, isCurrentPlan, organizationId }: Props) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    if (!planData.priceId) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: planData.priceId, organizationId }),
      })
      const { url } = await res.json() as { url: string }
      window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 ${isCurrentPlan ? 'border-brand-500 bg-brand-500/5' : 'border-surface-700 bg-surface-800'}`}>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-brand-400 mb-1">{planData.name}</div>
        <div className="text-3xl font-extrabold text-surface-50">${planData.price}<span className="text-sm font-normal text-surface-400">/mo</span></div>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-surface-300">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {isCurrentPlan ? (
        <div className="rounded-lg bg-brand-500/10 border border-brand-500/30 py-2 text-center text-sm font-semibold text-brand-400">Current Plan</div>
      ) : plan !== 'free' ? (
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : `Upgrade to ${planData.name}`}
        </button>
      ) : null}
    </div>
  )
}
