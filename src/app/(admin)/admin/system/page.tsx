'use client'
// ============================================================
// /admin/system — System Health Dashboard
// Platform admin only (enforced by (admin) layout).
// Shows health checks, circuit breakers, disabled capabilities,
// error rates, and recent system alerts.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, CheckCircle2, AlertCircle, XCircle, ShieldCheck,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

// ── Types ────────────────────────────────────────────────────

interface SystemAlert {
  id:           string
  alert_type:   string
  severity:     'info' | 'warning' | 'critical'
  capability?:  string
  title:        string
  body:         string
  metadata:     Record<string, unknown>
  created_at:   string
}

interface CapabilityOverride {
  capability:      string
  disabled:        boolean
  disabled_reason: string | null
  disabled_at:     string | null
  auto_disabled:   boolean
  re_enabled_at:   string | null
}

interface ErrorRateRow {
  capability:    string
  invocations1h: number
  errorRate1h:   number
  baselineRate:  number
  spikeMultiple: number
  isSpike:       boolean
}

interface HealthData {
  alerts:               SystemAlert[]
  capabilityOverrides:  CapabilityOverride[]
  errorRates:           ErrorRateRow[]
  circuitBreakers:      Record<string, string>
  summary: {
    dbOk:                  boolean
    invocationsLastHour:   number
    disabledCapabilities:  number
    criticalAlerts:        number
  }
}

// ── Helpers ───────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SEVERITY_PILL: Record<string, string> = {
  info:     'bg-blue-500/20 text-blue-300',
  warning:  'bg-amber-500/20 text-amber-300',
  critical: 'bg-red-500/20 text-red-300',
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 }

// ── Page ──────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<HealthData>({
    queryKey: ['admin-system-health'],
    queryFn:  async () => {
      const res = await apiFetch('/api/admin/system-health')
      if (!res.ok) throw new Error('Failed to load system health')
      return res.json()
    },
    staleTime: 30_000,
  })

  const sortedAlerts = [...(data?.alerts ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  )

  const disabledOverrides = (data?.capabilityOverrides ?? []).filter(o => o.disabled)

  async function reEnable(capability: string) {
    await apiFetch(`/api/admin/capability-overrides/${encodeURIComponent(capability)}`, { method: 'PATCH' })
    refetch()
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-bold text-surface-50">System Health</h1>
          </div>
          <p className="text-sm text-surface-500">
            Circuit breakers, error rates, auto-disabled capabilities and recent alerts.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          Failed to load system health data. Check your connection and try again.
        </div>
      )}

      {/* ── Health Status grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Database',
            ok:    data?.summary.dbOk,
          },
          {
            label: 'Invocations (1h)',
            value: data?.summary.invocationsLastHour,
            ok:    true,
          },
          {
            label: 'Disabled Capabilities',
            value: data?.summary.disabledCapabilities,
            ok:    (data?.summary.disabledCapabilities ?? 0) === 0,
          },
          {
            label: 'Critical Alerts',
            value: data?.summary.criticalAlerts,
            ok:    (data?.summary.criticalAlerts ?? 0) === 0,
          },
        ].map(card => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{card.label}</p>
              {isLoading ? (
                <div className="h-4 w-4 bg-surface-800 rounded animate-pulse" />
              ) : card.ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
            {isLoading
              ? <div className="h-8 w-16 bg-surface-800 rounded animate-pulse" />
              : card.value !== undefined
                ? <p className="text-3xl font-bold text-surface-50">{card.value}</p>
                : <span className={`text-sm font-semibold ${card.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {card.ok ? 'Healthy' : 'Unhealthy'}
                  </span>
            }
          </div>
        ))}
      </div>

      {/* ── Circuit Breakers ── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">Circuit Breakers</h2>
        {isLoading
          ? <div className="flex gap-3">{[1, 2].map(i => <div key={i} className="h-7 w-40 bg-surface-800 rounded animate-pulse" />)}</div>
          : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(data?.circuitBreakers ?? {}).map(([name, state]) => {
                const color = state === 'closed' ? 'bg-green-500/20 text-green-300'
                  : state === 'open'    ? 'bg-red-500/20 text-red-300'
                  : 'bg-amber-500/20 text-amber-300'
                const Icon = state === 'closed' ? CheckCircle2
                  : state === 'open'    ? XCircle
                  : AlertCircle
                return (
                  <div key={name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {name}: {state}
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {/* ── Auto-disabled capabilities banner ── */}
      {!isLoading && disabledOverrides.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-300">
              {disabledOverrides.length} capability{disabledOverrides.length > 1 ? 'ies' : 'y'} auto-disabled
            </span>
          </div>
          {disabledOverrides.map(o => (
            <div key={o.capability} className="flex items-center justify-between gap-4 bg-surface-900/50 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-surface-100">{o.capability}</p>
                {o.disabled_reason && (
                  <p className="text-xs text-surface-400 mt-0.5">{o.disabled_reason}</p>
                )}
                {o.disabled_at && (
                  <p className="text-xs text-surface-500">{relativeTime(o.disabled_at)}</p>
                )}
              </div>
              <button
                onClick={() => reEnable(o.capability)}
                className="btn-ghost text-xs text-green-400 hover:text-green-300 whitespace-nowrap"
              >
                Re-enable
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Error Rates table ── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">Error Rates — Top Capabilities</h2>
        {isLoading
          ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-9 bg-surface-800 rounded animate-pulse" />)}</div>
          : (data?.errorRates ?? []).length === 0
            ? <p className="text-sm text-surface-500">No capability data yet.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-800">
                      <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide pb-2 pr-4">Capability</th>
                      <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wide pb-2 px-4">Invocations (1h)</th>
                      <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wide pb-2 px-4">Error %</th>
                      <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wide pb-2 px-4">Baseline %</th>
                      <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wide pb-2 pl-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {(data?.errorRates ?? []).map(row => (
                      <tr key={row.capability}>
                        <td className="py-2.5 pr-4 font-medium text-surface-100">{row.capability}</td>
                        <td className="py-2.5 px-4 text-right text-surface-300">{row.invocations1h}</td>
                        <td className={`py-2.5 px-4 text-right font-semibold ${row.errorRate1h > 10 ? 'text-red-400' : row.errorRate1h > 5 ? 'text-amber-400' : 'text-green-400'}`}>
                          {row.errorRate1h.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right text-surface-400">{row.baselineRate.toFixed(1)}%</td>
                        <td className="py-2.5 pl-4 text-right">
                          {row.isSpike ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-300">
                              {row.spikeMultiple.toFixed(1)}x spike
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-300">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* ── Recent Alerts ── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">Recent Alerts</h2>
        {isLoading
          ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-surface-800 rounded animate-pulse" />)}</div>
          : sortedAlerts.length === 0
            ? <p className="text-sm text-surface-500">No alerts recorded.</p>
            : (
              <div className="space-y-2">
                {sortedAlerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 py-3 border-b border-surface-800 last:border-0">
                    <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${SEVERITY_PILL[alert.severity] ?? 'bg-surface-700 text-surface-400'}`}>
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-100">{alert.title}</p>
                      <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{alert.body}</p>
                    </div>
                    <p className="text-xs text-surface-500 whitespace-nowrap">{relativeTime(alert.created_at)}</p>
                  </div>
                ))}
              </div>
            )
        }
      </div>

    </div>
  )
}
