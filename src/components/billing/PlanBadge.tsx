'use client'

import { cn } from '@/lib/utils'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

interface PlanBadgeProps {
  plan:       PlanKey
  className?: string
}

const PLAN_COLORS: Record<PlanKey, string> = {
  field_pro:    'bg-surface-700 text-surface-300',
  starter:      'bg-surface-600 text-surface-200',
  professional: 'bg-brand-500/20 text-brand-300 border border-brand-500/30',
  enterprise:   'bg-purple-500/20 text-purple-300 border border-purple-500/30',
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
        PLAN_COLORS[plan],
        className
      )}
    >
      {PLANS[plan].name}
    </span>
  )
}
