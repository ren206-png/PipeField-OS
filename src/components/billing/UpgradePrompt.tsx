'use client'

import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

// ── Variant A: feature-gate (which plan unlocks it) ──────────
interface FeatureGateProps {
  feature:      string
  requiredPlan: PlanKey
  limit?:       never
  currentPlan?: never
}

// ── Variant B: limit-exceeded (how many are allowed) ─────────
interface LimitExceededProps {
  feature:      string
  limit:        number
  currentPlan:  string
  requiredPlan?: never
}

type UpgradePromptProps = FeatureGateProps | LimitExceededProps

function isLimitExceeded(props: UpgradePromptProps): props is LimitExceededProps {
  return (props as LimitExceededProps).limit !== undefined
}

export function UpgradePrompt(props: UpgradePromptProps) {
  let title:    string
  let subtitle: string

  if (isLimitExceeded(props)) {
    title    = `${props.feature} limit reached`
    subtitle = `Your ${props.currentPlan} plan allows up to ${props.limit}. Upgrade to add more.`
  } else {
    const planName = PLANS[props.requiredPlan].name
    title    = `${props.feature} requires the ${planName} plan`
    subtitle = 'Upgrade to unlock this feature and more.'
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center rounded-xl border border-orange-500/20 bg-orange-500/5">
      <div className="w-12 h-12 rounded-full bg-orange-500/15 flex items-center justify-center">
        <Lock className="w-6 h-6 text-orange-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-surface-100">
          {title}
        </p>
        <p className="text-xs text-surface-500">
          {subtitle}
        </p>
      </div>
      <Link
        href="/settings?tab=billing"
        className="btn-primary text-sm inline-flex items-center gap-2"
      >
        Upgrade Now
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
