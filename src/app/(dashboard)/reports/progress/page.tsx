'use client'
// ============================================================
// Progress S-Curve — Cumulative weld and spool completion
// ============================================================
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

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
    return { period: month, count: weekly[month], cumulative }
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
          {/* Charts side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weld Progress */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Weld Progress</h2>
              {weldCurve.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
                  No weld data with dates for this project
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={weldCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#e5e7eb' }}
                      itemStyle={{ color: '#f97316' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative Welds"
                      stroke="#f97316"
                      fill="url(#weldGrad)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Spool Progress */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Spool Release Progress</h2>
              {spoolCurve.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
                  No released spools with dates for this project
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={spoolCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spoolGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#e5e7eb' }}
                      itemStyle={{ color: '#3b82f6' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative Spools Released"
                      stroke="#3b82f6"
                      fill="url(#spoolGrad)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total Welds"    value={weldData?.stats.total ?? 0} />
            <StatCard label="Accepted Welds" value={weldData?.stats.accepted ?? 0} />
            <StatCard label="Pass Rate"      value={`${weldPassRate}%`} />
            <StatCard label="Total Spools"   value={spoolData?.stats.total ?? 0} />
            <StatCard label="Released Spools" value={spoolData?.stats.complete ?? 0} />
          </div>
        </>
      )}
    </div>
  )
}
