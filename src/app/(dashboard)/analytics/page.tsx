'use client'
// ============================================================
// QC Analytics Dashboard — Tier 2 Feature 2
// ============================================================
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, CheckCircle2, XCircle, AlertTriangle,
  FlaskConical, Flame, FileSearch,
  Cpu,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import type { QcAnalytics } from '@/app/api/analytics/qc/route'

// ── helpers ──────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d'

function passRateColor(rate: number) {
  if (rate >= 95) return 'text-green-400'
  if (rate >= 85) return 'text-amber-400'
  return 'text-red-400'
}

function passRateBg(rate: number) {
  if (rate >= 95) return 'border-green-500/30 bg-green-500/5'
  if (rate >= 85) return 'border-amber-500/30 bg-amber-500/5'
  return 'border-red-500/30 bg-red-500/5'
}

// ── Skeleton ─────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-surface-800', className)} />
}

function KpiSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, valueClass, cardClass,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  valueClass?: string
  cardClass?: string
}) {
  return (
    <div className={cn('card p-5 border', cardClass ?? 'border-surface-800')}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-surface-500" />
        <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-4xl font-bold', valueClass ?? 'text-surface-50')}>{value}</p>
      {sub && <p className="text-xs text-surface-600 mt-1">{sub}</p>}
    </div>
  )
}

// ── Weld Status Bar ───────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; pill: string }> = {
  accepted:       { label: 'Accepted',       color: 'bg-green-500',  pill: 'bg-green-500/15 text-green-300'  },
  rejected:       { label: 'Rejected',       color: 'bg-red-500',    pill: 'bg-red-500/15 text-red-300'      },
  pending:        { label: 'Pending',        color: 'bg-surface-500',pill: 'bg-surface-700 text-surface-400' },
  in_progress:    { label: 'In Progress',    color: 'bg-blue-500',   pill: 'bg-blue-500/15 text-blue-300'    },
  requires_repair:{ label: 'Req. Repair',    color: 'bg-amber-500',  pill: 'bg-amber-500/15 text-amber-300'  },
  not_welded:     { label: 'Not Welded',     color: 'bg-surface-700',pill: 'bg-surface-800 text-surface-500' },
}

function WeldStatusBreakdown({ data }: { data: QcAnalytics }) {
  const total = data.total_welds
  const statuses = Object.entries(data.welds_by_status).sort((a, b) => b[1] - a[1])

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-surface-200 mb-4">Weld Status Breakdown</h3>
      {/* Stacked bar */}
      {total > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-px">
          {statuses.map(([status, count]) => {
            const cfg = STATUS_CONFIG[status]
            const pct = (count / total) * 100
            return (
              <div
                key={status}
                className={cn('h-full', cfg?.color ?? 'bg-surface-600')}
                style={{ width: `${pct}%` }}
                title={`${cfg?.label ?? status}: ${count}`}
              />
            )
          })}
        </div>
      )}
      {/* Pills */}
      <div className="flex flex-wrap gap-2">
        {statuses.map(([status, count]) => {
          const cfg = STATUS_CONFIG[status]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <span
              key={status}
              className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium', cfg?.pill ?? 'bg-surface-700 text-surface-400')}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', cfg?.color ?? 'bg-surface-600')} />
              {cfg?.label ?? status}
              <span className="font-bold">{count}</span>
              <span className="opacity-60">{pct}%</span>
            </span>
          )
        })}
        {statuses.length === 0 && <p className="text-xs text-surface-600">No weld data</p>}
      </div>
    </div>
  )
}

// ── Sparkline (CSS bars) ──────────────────────────────────────

function SparklineCard({ data, period }: { data: QcAnalytics; period: Period }) {
  const days = data.welds_created_by_day
  const maxCount = Math.max(...days.map(d => d.count), 1)
  const periodDays = parseInt(period)

  // Fill in missing days
  const filledDays: { date: string; count: number }[] = []
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const found = days.find(x => x.date === dateStr)
    filledDays.push({ date: dateStr, count: found?.count ?? 0 })
  }

  // Show at most 30 bars; if 90d show every 3rd label
  const showLabel = (i: number) => {
    if (periodDays <= 7) return true
    if (periodDays <= 30) return i % 7 === 0 || i === filledDays.length - 1
    return i % 15 === 0 || i === filledDays.length - 1
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-surface-200 mb-4">
        Welds Created <span className="text-surface-500 font-normal">(last {period})</span>
      </h3>
      <div className="flex items-end gap-0.5 h-24">
        {filledDays.map((d, i) => {
          const pct = d.count / maxCount
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-0.5 group relative"
              title={`${d.date}: ${d.count} weld${d.count !== 1 ? 's' : ''}`}
            >
              <div
                className="w-full bg-brand-500/70 group-hover:bg-brand-400 transition-colors rounded-t-sm"
                style={{ height: `${Math.max(pct * 80, d.count > 0 ? 4 : 1)}px` }}
              />
              {showLabel(i) && (
                <span className="text-[8px] text-surface-600 whitespace-nowrap rotate-45 origin-left mt-1">
                  {d.date.slice(5)}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {days.length === 0 && (
        <p className="text-xs text-surface-600 mt-2">No welds created in this period</p>
      )}
    </div>
  )
}

// ── NDE By Type Table ─────────────────────────────────────────

function NdeByTypeCard({ data }: { data: QcAnalytics }) {
  const entries = Object.entries(data.nde_by_type)
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-surface-200 mb-4">NDE Results by Type</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-surface-600">No NDE data in this period</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-surface-800">
                <th className="pb-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">Type</th>
                <th className="pb-2 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Selected</th>
                <th className="pb-2 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Pass</th>
                <th className="pb-2 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Fail</th>
                <th className="pb-2 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {entries.sort((a, b) => b[1].total - a[1].total).map(([type, stats]) => {
                const rate = stats.total > 0
                  ? Math.round((stats.pass / stats.total) * 100)
                  : 0
                return (
                  <tr key={type} className="hover:bg-surface-800/50 transition-colors">
                    <td className="py-2 font-mono text-xs text-surface-300 font-medium">{type}</td>
                    <td className="py-2 text-right text-surface-300">{stats.total}</td>
                    <td className="py-2 text-right text-green-400">{stats.pass}</td>
                    <td className="py-2 text-right text-red-400">{stats.fail}</td>
                    <td className={cn('py-2 text-right font-semibold', passRateColor(rate))}>{rate}%</td>
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

// ── Flange Status ─────────────────────────────────────────────

const FLANGE_STATUS_CONFIG: Record<string, string> = {
  pending:       'bg-surface-700 text-surface-400',
  installed:     'bg-blue-500/15 text-blue-300',
  torqued:       'bg-brand-500/15 text-brand-300',
  leak_tested:   'bg-green-500/15 text-green-300',
  failed:        'bg-red-500/15 text-red-300',
  requires_rework: 'bg-amber-500/15 text-amber-300',
}

function FlangeStatusCard({ data }: { data: QcAnalytics }) {
  const entries = Object.entries(data.flanges_by_status)
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CircleDotIcon className="w-4 h-4 text-surface-500" />
        <h3 className="text-sm font-semibold text-surface-200">Flange Status</h3>
        <span className="ml-auto text-xs text-surface-500">{data.total_flanges} total</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-surface-600">No flange data</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <span
              key={status}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                FLANGE_STATUS_CONFIG[status] ?? 'bg-surface-700 text-surface-400'
              )}
            >
              {status.replace(/_/g, ' ')}
              <span className="font-bold">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Simple inline SVG icon (CircleDot) ───────────────────────

function CircleDotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

// ── Material Coverage Card ────────────────────────────────────

function MaterialCoverageCard({ data }: { data: QcAnalytics }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileSearch className="w-4 h-4 text-surface-500" />
        <h3 className="text-sm font-semibold text-surface-200">Material Coverage</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-surface-50">{data.total_heat_numbers}</p>
          <p className="text-xs text-surface-500 mt-1">Heat Numbers in Use</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-brand-400">{data.mtrs_on_file}</p>
          <p className="text-xs text-surface-500 mt-1">MTRs on File</p>
        </div>
      </div>
    </div>
  )
}

// ── AI Usage Card ─────────────────────────────────────────────

function AiUsageCard({ data }: { data: QcAnalytics }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-surface-200">AI Usage</h3>
        <span className="ml-auto text-xs text-brand-400 font-semibold">{data.ai_invocations} invocations</span>
      </div>
      {data.ai_top_capabilities.length === 0 ? (
        <p className="text-xs text-surface-600">No AI usage in this period</p>
      ) : (
        <ol className="space-y-2">
          {data.ai_top_capabilities.map((item, i) => (
            <li key={item.capability} className="flex items-center gap-3">
              <span className="text-xs font-bold text-surface-600 w-4 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-surface-300 truncate capitalize">
                    {item.capability.replace(/-/g, ' ')}
                  </span>
                  <span className="text-xs font-semibold text-brand-300 ml-2">{item.count}</span>
                </div>
                <div className="h-1 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{
                      width: `${data.ai_top_capabilities[0].count > 0
                        ? (item.count / data.ai_top_capabilities[0].count) * 100
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function QcAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [projectId, setProjectId] = useState<string>('')

  const { data: projects } = useProjectsList()

  const { data, isLoading, isError } = useQuery<QcAnalytics>({
    queryKey: ['qc-analytics', period, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (projectId) params.set('project_id', projectId)
      const res = await apiFetch(`/api/analytics/qc?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load QC analytics')
      return res.json()
    },
    staleTime: 60_000,
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500/15 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-50">QC Analytics</h1>
            <p className="text-xs text-surface-500">Quality control metrics and trends</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project filter */}
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-sm bg-surface-800 border border-surface-700 text-surface-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Projects</option>
            {(projects ?? []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-surface-700">
            {(['7d', '30d', '90d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-2 text-xs font-medium transition-colors',
                  period === p
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="card p-6 text-center border border-red-500/20">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-300">Failed to load analytics data</p>
          <p className="text-xs text-surface-500 mt-1">Check your connection and try again</p>
        </div>
      )}

      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : data ? (
          <>
            <KpiCard
              label="Weld Pass Rate"
              value={`${data.weld_pass_rate.toFixed(1)}%`}
              sub={`${data.welds_by_status['accepted'] ?? 0} accepted / ${(data.welds_by_status['rejected'] ?? 0)} rejected`}
              icon={CheckCircle2}
              valueClass={passRateColor(data.weld_pass_rate)}
              cardClass={cn('border', passRateBg(data.weld_pass_rate))}
            />
            <KpiCard
              label="Total Welds"
              value={data.total_welds}
              sub={`${period} window`}
              icon={Flame}
            />
            <KpiCard
              label="NDE Pass Rate"
              value={`${data.nde_pass_rate.toFixed(1)}%`}
              sub={`${data.nde_total_selected} inspections`}
              icon={FlaskConical}
              valueClass={passRateColor(data.nde_pass_rate)}
              cardClass={cn('border', passRateBg(data.nde_pass_rate))}
            />
            <KpiCard
              label="Qual Flags Raised"
              value={data.qual_flags_raised}
              sub={`${data.qual_flags_resolved} resolved · ${data.qual_blocks} blocks`}
              icon={AlertTriangle}
              valueClass={data.qual_flags_raised > 0 ? 'text-red-400' : 'text-surface-50'}
              cardClass={data.qual_flags_raised > 0 ? 'border border-red-500/20 bg-red-500/5' : undefined}
            />
          </>
        ) : null}
      </div>

      {/* Row 2 — Weld Status Breakdown */}
      {isLoading ? (
        <Skeleton className="h-28" />
      ) : data ? (
        <WeldStatusBreakdown data={data} />
      ) : null}

      {/* Row 3 — Sparkline + NDE by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </>
        ) : data ? (
          <>
            <SparklineCard data={data} period={period} />
            <NdeByTypeCard data={data} />
          </>
        ) : null}
      </div>

      {/* Row 4 — Flange Status + Material Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : data ? (
          <>
            <FlangeStatusCard data={data} />
            <MaterialCoverageCard data={data} />
          </>
        ) : null}
      </div>

      {/* Row 5 — AI Usage */}
      {isLoading ? (
        <Skeleton className="h-44" />
      ) : data ? (
        <AiUsageCard data={data} />
      ) : null}
    </div>
  )
}
