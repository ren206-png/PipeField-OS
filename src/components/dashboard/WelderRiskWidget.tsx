'use client'
// ============================================================
// WelderRiskWidget — dashboard card showing welder risk scores
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import { AlertTriangle, TrendingUp, CheckCircle, ShieldAlert, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface WelderRisk {
  stamp:       string
  name:        string
  total_30d:   number
  failed_30d:  number
  rate_30d:    number
  total_7d:    number
  rate_7d:     number
  trending_up: boolean
  risk:        'critical' | 'warning' | 'watch' | 'good'
}

const RISK_CONFIG = {
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: ShieldAlert,    label: 'Critical' },
  warning:  { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: AlertTriangle,  label: 'Warning'  },
  watch:    { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: TrendingUp,     label: 'Watch'    },
  good:     { color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: CheckCircle,    label: 'Good'     },
}

export function WelderRiskWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['welder-risk'],
    queryFn: async () => {
      const res = await apiFetch('/api/analytics/welder-risk')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ welders: WelderRisk[]; generated_at: string }>
    },
    staleTime: 5 * 60 * 1000,
  })

  const flagged = data?.welders.filter(w => w.risk !== 'good') ?? []
  const allGood = !isLoading && flagged.length === 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-surface-400" />
          <h2 className="text-sm font-semibold text-surface-100">Welder Risk Monitor</h2>
        </div>
        <Link href="/welders" className="text-xs text-brand-400 hover:text-brand-300">
          All welders →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-12 bg-surface-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : allGood ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
          <p className="text-sm font-medium text-surface-200">All welders on track</p>
          <p className="text-xs text-surface-500 mt-1">No elevated rejection rates in the last 30 days</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flagged.slice(0, 5).map(w => {
            const cfg = RISK_CONFIG[w.risk]
            const Icon = cfg.icon
            return (
              <div
                key={w.stamp}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border', cfg.bg, cfg.border)}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', cfg.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-surface-100 truncate">{w.name}</span>
                    <span className="text-xs text-surface-500 flex-shrink-0">{w.stamp}</span>
                  </div>
                  <p className="text-xs text-surface-400">
                    {w.rate_30d}% rejection — {w.failed_30d}/{w.total_30d} welds failed (30d)
                    {w.trending_up && <span className="text-yellow-400 ml-1">↑ trending up</span>}
                  </p>
                </div>
                <span className={cn('text-xs font-semibold flex-shrink-0', cfg.color)}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
          {data && data.welders.filter(w => w.risk === 'good').length > 0 && (
            <p className="text-xs text-surface-600 pt-1 text-center">
              {data.welders.filter(w => w.risk === 'good').length} other welders performing well
            </p>
          )}
        </div>
      )}
    </div>
  )
}
