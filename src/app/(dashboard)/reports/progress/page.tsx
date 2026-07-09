'use client'
// ============================================================
// Progress S-Curve — Cumulative weld and spool completion
// ============================================================
import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { useQuery } from '@tanstack/react-query'

// Recharts is ~60 kB — only loaded when charts are rendered
const ProgressCharts = dynamic(
  () => import('@/components/reports/ProgressCharts').then(m => m.ProgressCharts),
  {
    ssr:     false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
)

function buildWeeklyCumulative(rows: Record<string, unknown>[], dateField: string) {
  const weekly: Record<string, number> = {}
  rows.forEach(r => {
    const d = r[dateField] as string | null
    if (!d) return
    const month = d.slice(0, 7) // YYYY-MM buckets
    weekly[month] = (weekly[month] ?? 0) + 1
  })
  const sorted = Object.keys(weekly).sort()
  let cumulative = 0
  return sorted.map(month => {
    cumulative += weekly[month]
    return { period: month, count: weekly[month] ?? 0, cumulative }
  })
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs text-surface-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-surface-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ProgressPage() {
  const { profile } = useAuth()
  const { data: projects = [] } = useProjects()
  const [projectId, setProjectId] = useState('')

  const { data: weldData, isLoading: weldsLoading } = useQuery({
    queryKey: ['progress-welds', projectId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      if (!projectId || !profile?.organization_id) return { rows: [], stats: { total: 0, accepted: 0 } }
      const { data, error } = await createClient()
        .from('welds')
        .select('weld_date, status')
        .eq('project_id', projectId)
        .eq('organization_id', profile.organization_id)
        .not('weld_date', 'is', null)
        .order('weld_date', { ascending: true })
      if (error) throw error
      const rows = data ?? []
      const accepted = rows.filter(w => w.status === 'accepted').length
      return { rows, stats: { total: rows.length, accepted } }
    },
    enabled: !!projectId && !!profile?.organization_id,
  })

  const { data: spoolData, isLoading: spoolsLoading } = useQuery({
    queryKey: ['progress-spools', projectId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      if (!projectId || !profile?.organization_id) return { rows: [], stats: { total: 0, complete: 0 } }
      const { data, error } = await createClient()
        .from('spools')
        .select('released_date, status, updated_at')
        .eq('project_id', projectId)
        .eq('organization_id', profile.organization_id)
        .order('updated_at', { ascending: true })
      if (error) throw error
      const rows = data ?? []
      const complete = rows.filter(s => s.status === 'released').length
      return { rows, stats: { total: rows.length, complete } }
    },
    enabled: !!projectId && !!profile?.organization_id,
  })

  const weldCurve  = weldData  ? buildWeeklyCumulative(weldData.rows as Record<string, unknown>[],  'weld_date')     : []
  const spoolCurve = spoolData ? buildWeeklyCumulative(
    (spoolData.rows as Record<string, unknown>[]).filter(r => r.status === 'released'),
    'released_date'
  ) : []

  const isLoading = weldsLoading || spoolsLoading

  const weldPassRate = weldData && weldData.stats.total > 0
    ? Math.round((weldData.stats.accepted / weldData.stats.total) * 100)
    : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/reports" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h1 className="text-2xl font-bold text-surface-50">Progress S-Curve</h1>
          </div>
          <p className="text-sm text-surface-500 mt-0.5">Cumulative weld and spool completion over time</p>
        </div>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <label className="label whitespace-nowrap">Select Project</label>
        <select
          className="input max-w-[320px]"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
        >
          <option value="">Choose a project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
        </select>
      </div>

      {!projectId ? (
        <div className="card p-16 text-center">
          <TrendingUp className="w-12 h-12 text-surface-600 mx-auto mb-4" />
          <p className="text-surface-400">Select a project to view progress</p>
          <p className="text-xs text-surface-600 mt-1">S-curves show cumulative completion by month</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Charts — recharts loaded on demand */}
          <ProgressCharts weldCurve={weldCurve} spoolCurve={spoolCurve} />

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total Welds"     value={weldData?.stats.total ?? 0} />
            <StatCard label="Accepted Welds"  value={weldData?.stats.accepted ?? 0} />
            <StatCard label="Pass Rate"       value={`${weldPassRate}%`} />
            <StatCard label="Total Spools"    value={spoolData?.stats.total ?? 0} />
            <StatCard label="Released Spools" value={spoolData?.stats.complete ?? 0} />
          </div>
        </>
      )}
    </div>
  )
}
