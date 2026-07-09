'use client'
// ============================================================
// RejectionRateCard
// Displays a per-welder rejection rate dashboard widget.
// Fetches from GET /api/welders/rejection-rates (90-day window).
//
// Status thresholds:
//   🟢 Good  — rate < 5%
//   🟡 Watch — rate 5%–10%
//   🔴 Alert — rate > 10%
// ============================================================
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'

interface WelderRejectionRate {
  welderId:   string
  welderName: string
  stamp:      string
  total:      number
  failed:     number
  rate:       number
}

type StatusLevel = 'good' | 'watch' | 'alert'

function getStatus(rate: number): StatusLevel {
  if (rate > 0.10) return 'alert'
  if (rate >= 0.05) return 'watch'
  return 'good'
}

const STATUS_CONFIG: Record<StatusLevel, { icon: string; label: string; color: string; badgeBg: string }> = {
  good:  { icon: '🟢', label: 'Good',  color: '#22c55e', badgeBg: 'rgba(34,197,94,0.15)'  },
  watch: { icon: '🟡', label: 'Watch', color: '#f59e0b', badgeBg: 'rgba(245,158,11,0.15)' },
  alert: { icon: '🔴', label: 'Alert', color: '#ef4444', badgeBg: 'rgba(239,68,68,0.15)'  },
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function RejectionRateCard() {
  const [rows,    setRows]    = useState<WelderRejectionRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch('/api/welders/rejection-rates')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<WelderRejectionRate[]>
      })
      .then(data => {
        if (!cancelled) {
          setRows(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          setError(msg)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-700">
        <div>
          <h2 className="font-semibold text-surface-100">Welder Performance</h2>
          <p className="text-xs text-surface-500 mt-0.5">Rejection rates — last 90 days</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-surface-500">
          <span>🟢 &lt;5%</span>
          <span>🟡 5–10%</span>
          <span>🔴 &gt;10%</span>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="px-5 py-8 text-center text-surface-500 text-sm">
          Loading welder stats…
        </div>
      )}

      {!loading && error && (
        <div className="px-5 py-6 text-center text-red-400 text-sm">
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="px-5 py-8 text-center text-surface-500 text-sm">
          No weld data in the last 90 days.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-surface-700">
                <th className="px-5 py-3 text-xs font-medium text-surface-500 uppercase tracking-wide">Welder</th>
                <th className="px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wide text-right">Total (90d)</th>
                <th className="px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wide text-right">Failed</th>
                <th className="px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wide text-right">Rate</th>
                <th className="px-5 py-3 text-xs font-medium text-surface-500 uppercase tracking-wide text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {rows.map(row => {
                const status = getStatus(row.rate)
                const cfg    = STATUS_CONFIG[status]
                return (
                  <tr key={row.welderId} className="hover:bg-surface-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-300 flex-shrink-0 font-mono">
                          {row.stamp.slice(0, 4)}
                        </div>
                        <span className="text-surface-200 font-medium">{row.welderName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-surface-300 tabular-nums">{row.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span style={{ color: row.failed > 0 ? '#ef4444' : '#6b7280' }}>
                        {row.failed}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: cfg.color }}>
                      {pct(row.rate)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: cfg.badgeBg, color: cfg.color }}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
