'use client'
// Shown instead of plans / checkout inside the iOS and Android apps.
// Deliberately has no purchase button and no link to buy elsewhere
// (store rules forbid steering to outside payment from inside the app).
import { CreditCard } from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'

const TIER_LABEL: Record<string, string> = {
  free_trial: 'Free trial',
  field_pro: 'Field Pro',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

export function NativeBillingNotice() {
  const { organization } = useOrganization()
  const tier = organization?.subscription_tier ?? 'free_trial'
  const status = organization?.subscription_status

  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-surface-700 bg-surface-800 p-6 space-y-3">
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-brand-400" aria-hidden="true" />
        <h1 className="text-lg font-bold text-surface-100">Your plan</h1>
      </div>
      <p className="text-2xl font-semibold text-surface-100">{TIER_LABEL[tier] ?? tier}</p>
      {status && <p className="text-sm text-surface-400 capitalize">Status: {status.replace('_', ' ')}</p>}
      <p className="text-sm text-surface-400">
        Plans and billing can&apos;t be changed in the app.
      </p>
    </div>
  )
}
