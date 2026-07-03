'use client'
// ============================================================
// UsageBar — visual usage meter shown in the sidebar.
// Displays projects, users, and welds against plan limits.
// ============================================================
import Link from 'next/link'
import { useUsage } from '@/hooks/useUsage'
import { limitLabel } from '@/lib/plans'

function Bar({
  current,
  limit,
  label,
}: {
  current: number
  limit:   number | null
  label:   string
}) {
  const effectiveLimit = limit ?? Infinity
  const pct            = effectiveLimit === Infinity
    ? 0
    : Math.min((current / effectiveLimit) * 100, 100)
  const color          = pct >= 90
    ? 'bg-red-500'
    : pct >= 70
    ? 'bg-amber-500'
    : 'bg-brand-500'

  return (
    <div>
      <div className="flex justify-between text-xs text-surface-400 mb-1">
        <span>{label}</span>
        <span>
          {current} / {limitLabel(limit)}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 bg-surface-700 rounded-full">
          <div
            className={`h-1.5 rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function UsageBar() {
  const { data: usage } = useUsage()
  if (!usage) return null

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-surface-300 uppercase tracking-wide">
          Usage
        </span>
        <span className="text-xs rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-semibold text-brand-400 capitalize">
          {usage.plan}
        </span>
      </div>

      <Bar
        current={usage.usage.projects}
        limit={usage.limits.projects}
        label="Projects"
      />
      <Bar
        current={usage.usage.users}
        limit={usage.limits.users}
        label="Team Members"
      />
      <Bar
        current={usage.usage.welds}
        limit={usage.limits.welds}
        label="Welds"
      />

      {usage.plan === 'starter' && (
        <Link
          href="/settings?tab=billing"
          className="block text-center text-xs font-semibold text-brand-400 hover:text-brand-300 pt-1 transition-colors"
        >
          Upgrade plan →
        </Link>
      )}
    </div>
  )
}
