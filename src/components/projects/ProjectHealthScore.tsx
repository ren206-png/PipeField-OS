'use client'
// ============================================================
// ProjectHealthScore — composite 0–100 health card
// Fetches /api/projects/[id]/health and renders:
//   - Score (0–100) + grade letter
//   - Color-coded status badge (healthy / at_risk / critical)
//   - Per-component breakdown bar (welds, NDE, issues, spools)
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import { cn } from '@/lib/utils'
import { Activity } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
interface HealthData {
  score:  number
  grade:  string
  status: 'healthy' | 'at_risk' | 'critical'
  breakdown: {
    weld_pass_rate: number
    nde_backlog:    number
    open_issues:    number
    spool_progress: number
  }
  meta: {
    total_welds:     number
    accepted_welds:  number
    nde_pending:     number
    open_ncrs:       number
    open_rfis:       number
    total_spools:    number
    released_spools: number
  }
}

// ── Mini progress bar ─────────────────────────────────────────
function MiniBar({ value, max = 25, color }: { value: number; max?: number; color: string }) {
  const pct = Math.round((Math.min(value, max) / max) * 100)
  return (
    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden flex-1">
      <div
        className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Status styling ────────────────────────────────────────────
const STATUS_CONFIG = {
  healthy:  { label: 'Healthy',  badge: 'bg-green-500/15 text-green-300',  bar: 'bg-green-500'  },
  at_risk:  { label: 'At Risk',  badge: 'bg-amber-500/15 text-amber-300',  bar: 'bg-amber-500'  },
  critical: { label: 'Critical', badge: 'bg-red-500/15 text-red-300',      bar: 'bg-red-500'    },
} satisfies Record<string, { label: string; badge: string; bar: string }>

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="card p-5 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-surface-700 rounded w-32" />
        <div className="h-6 bg-surface-700 rounded w-16" />
      </div>
      <div className="h-2 bg-surface-700 rounded-full" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-8 bg-surface-700 rounded" />)}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function ProjectHealthScore({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useQuery<HealthData>({
    queryKey: ['project-health', projectId],
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${projectId}/health`)
      if (!res.ok) throw new Error('Failed to fetch health score')
      return res.json()
    },
    staleTime: 60_000,
  })

  if (isLoading) return <Skeleton />

  if (isError || !data) {
    return (
      <div className="card p-5 flex items-center gap-3 text-surface-500 text-sm">
        <Activity className="w-4 h-4 flex-shrink-0" />
        <span>Health score unavailable</span>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[data.status]
  const scorePct = data.score

  const breakdown = [
    { label: 'Welds',   value: data.breakdown.weld_pass_rate, color: 'bg-orange-500' },
    { label: 'NDE',     value: data.breakdown.nde_backlog,    color: 'bg-purple-500' },
    { label: 'Issues',  value: data.breakdown.open_issues,    color: 'bg-blue-500'   },
    { label: 'Spools',  value: data.breakdown.spool_progress, color: 'bg-teal-500'   },
  ]

  return (
    <div className="card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-surface-500" />
          <span className="text-sm font-semibold text-surface-200">Project Health</span>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.badge)}>
          {cfg.label}
        </span>
      </div>

      {/* Score + grade */}
      <div className="flex items-end gap-3">
        <div>
          <p className="text-3xl font-bold text-surface-50 leading-none">{data.score}</p>
          <p className="text-xs text-surface-500 mt-0.5">/ 100</p>
        </div>
        <div className={cn(
          'ml-1 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black',
          data.grade === 'A' ? 'bg-green-500/15 text-green-300' :
          data.grade === 'B' ? 'bg-teal-500/15 text-teal-300'   :
          data.grade === 'C' ? 'bg-yellow-500/15 text-yellow-300' :
          data.grade === 'D' ? 'bg-orange-500/15 text-orange-300' :
                               'bg-red-500/15 text-red-300'
        )}>
          {data.grade}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
          style={{ width: `${scorePct}%` }}
        />
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {breakdown.map(({ label, value, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-500">{label}</span>
              <span className="text-surface-400 font-medium tabular-nums">{value}</span>
            </div>
            <MiniBar value={value} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}
