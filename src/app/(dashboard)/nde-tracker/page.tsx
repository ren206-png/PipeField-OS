'use client'
// ============================================================
// NDE Tracker — Cross-project inspection registry
// All NDE records across all projects, with filters + stats
// ============================================================
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/hooks/useOrganization'
import { useProjectsList } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  FlaskConical, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronRight, Search, Filter, BarChart3, TrendingUp, RefreshCw
} from 'lucide-react'

// ── Type constants ────────────────────────────────────────────
const NDE_TYPES = ['RT','UT','PT','MT','VT','PMI','HT'] as const
const NDE_TYPE_FULL: Record<string, string> = {
  RT:  'Radiographic Testing',
  UT:  'Ultrasonic Testing',
  PT:  'Penetrant Testing',
  MT:  'Magnetic Particle Testing',
  VT:  'Visual Testing',
  PMI: 'Positive Material ID',
  HT:  'Hardness Testing',
}

const RESULT_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: 'Pending',  color: 'bg-surface-700 text-surface-400',   dot: 'bg-surface-500'  },
  pass:    { label: 'Pass',     color: 'bg-green-500/15 text-green-300',    dot: 'bg-green-400'    },
  fail:    { label: 'Fail',     color: 'bg-red-500/15 text-red-300',        dot: 'bg-red-400'      },
  repair:  { label: 'Repair',   color: 'bg-orange-500/15 text-orange-300',  dot: 'bg-orange-400'   },
  retest:  { label: 'Retest',   color: 'bg-yellow-500/15 text-yellow-300',  dot: 'bg-yellow-400'   },
}

interface NdeRecord {
  id: string
  weld_id: string
  project_id: string
  inspection_type: string
  result: string
  inspector_name: string | null
  inspection_date: string | null
  report_number: string | null
  acceptance_code: string | null
  defect_type: string | null
  defect_location: string | null
  notes: string | null
  created_at: string
  // joined
  welds?: { weld_id_number: string; spool_id: string | null }
  projects?: { name: string; project_number: string | null }
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-surface-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-surface-50">{value}</p>
      {sub && <p className="text-xs text-surface-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Donut chart (SVG) ─────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="w-24 h-24 rounded-full bg-surface-800 mx-auto" />

  let cumPct = 0
  const R = 40; const CX = 50; const CY = 50; const SW = 14
  const slices = data.map(d => {
    const pct   = d.value / total
    const start = cumPct * 360
    const end   = (cumPct + pct) * 360
    cumPct += pct

    const toRad = (deg: number) => (deg - 90) * (Math.PI / 180)
    const x1 = CX + R * Math.cos(toRad(start))
    const y1 = CY + R * Math.sin(toRad(start))
    const x2 = CX + R * Math.cos(toRad(end))
    const y2 = CY + R * Math.sin(toRad(end))
    const large = pct > 0.5 ? 1 : 0

    return {
      path: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      color: d.color,
      pct: Math.round(pct * 100),
      label: d.label,
      value: d.value,
    }
  })

  const passSlice = slices.find(s => s.label === 'Pass')

  return (
    <div className="flex items-center gap-6">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1f2937" strokeWidth={SW} />
        {slices.filter(s => s.value > 0).map((s, i) => (
          <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={SW} strokeLinecap="butt" />
        ))}
        {/* Center text */}
        {passSlice && (
          <>
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#f9fafb">{passSlice.pct}%</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#9ca3af">pass rate</text>
          </>
        )}
      </svg>
      <div className="space-y-1.5">
        {slices.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-surface-400">{s.label}</span>
            <span className="text-xs font-semibold text-surface-300 ml-auto pl-3">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function NdeTrackerPage() {
  const { organizationId } = useOrganization()
  const { data: projects = [] } = useProjectsList()

  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [typeFilter,    setTypeFilter]    = useState<string>('all')
  const [resultFilter,  setResultFilter]  = useState<string>('all')
  const [search,        setSearch]        = useState('')

  // Load all NDE inspections
  const { data: allRecords = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['nde-tracker', organizationId, projectFilter],
    staleTime: 60_000,
    enabled: !!organizationId,
    queryFn: async () => {
      let q = createClient()
        .from('nde_inspections')
        .select(`
          *,
          welds(weld_id_number, spool_id),
          projects(name, project_number)
        `)
        .eq('organization_id', organizationId!)
        .order('inspection_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (projectFilter !== 'all') {
        q = q.eq('project_id', projectFilter)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as NdeRecord[]
    },
  })

  // Apply client-side filters
  const records = useMemo(() => {
    return allRecords.filter(r => {
      if (typeFilter   !== 'all' && r.inspection_type !== typeFilter)   return false
      if (resultFilter !== 'all' && r.result          !== resultFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !r.welds?.weld_id_number?.toLowerCase().includes(q) &&
          !r.inspector_name?.toLowerCase().includes(q) &&
          !r.report_number?.toLowerCase().includes(q) &&
          !r.projects?.name?.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [allRecords, typeFilter, resultFilter, search])

  // Stats
  const stats = useMemo(() => {
    const total   = records.length
    const pass    = records.filter(r => r.result === 'pass').length
    const fail    = records.filter(r => r.result === 'fail').length
    const pending = records.filter(r => r.result === 'pending').length
    const repair  = records.filter(r => r.result === 'repair' || r.result === 'retest').length
    const passRate = (total - pending) > 0 ? Math.round((pass / (total - pending)) * 100) : 0

    // Type breakdown
    const byType: Record<string, number> = {}
    records.forEach(r => { byType[r.inspection_type] = (byType[r.inspection_type] ?? 0) + 1 })

    return { total, pass, fail, pending, repair, passRate, byType }
  }, [records])

  const donutData = [
    { label: 'Pass',    value: stats.pass,    color: '#10b981' },
    { label: 'Fail',    value: stats.fail,    color: '#ef4444' },
    { label: 'Repair',  value: stats.repair,  color: '#f59e0b' },
    { label: 'Pending', value: stats.pending, color: '#4b5563' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">NDE Tracker</h1>
          <p className="text-sm text-surface-500 mt-0.5">Non-Destructive Examination registry across all projects</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Inspections" value={stats.total}   icon={FlaskConical}  color="text-purple-400" />
        <StatCard label="Pass"              value={stats.pass}    icon={CheckCircle2}  color="text-green-400"  sub={`${stats.passRate}% pass rate`} />
        <StatCard label="Fail / Repair"     value={stats.fail + stats.repair} icon={XCircle} color="text-red-400" />
        <StatCard label="Pending"           value={stats.pending} icon={Clock}         color="text-yellow-400" />
      </div>

      {/* Charts + type breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            Result Breakdown
          </h3>
          <DonutChart data={donutData} />
        </div>

        {/* Type breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            By Inspection Type
          </h3>
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-surface-600 text-sm text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-2">
              {NDE_TYPES.filter(t => stats.byType[t]).map(t => {
                const count = stats.byType[t] ?? 0
                const max   = Math.max(...Object.values(stats.byType))
                return (
                  <div key={t} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-surface-400 w-8">{t}</span>
                    <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-surface-300 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="flex-1 min-w-48">
            <label className="label mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input
                className="input pl-9"
                placeholder="Weld #, inspector, report…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Project */}
          <div className="w-48">
            <label className="label mb-1.5">Project</label>
            <select className="input" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_number ? `${p.project_number} — ` : ''}{p.name}
                </option>
              ))}
            </select>
          </div>
          {/* Type */}
          <div className="w-36">
            <label className="label mb-1.5">Type</label>
            <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {NDE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Result */}
          <div className="w-36">
            <label className="label mb-1.5">Result</label>
            <select className="input" value={resultFilter} onChange={e => setResultFilter(e.target.value)}>
              <option value="all">All Results</option>
              {Object.entries(RESULT_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-800 flex items-center justify-between">
          <span className="text-sm text-surface-400">
            {records.length} record{records.length !== 1 ? 's' : ''}
            {(typeFilter !== 'all' || resultFilter !== 'all' || search || projectFilter !== 'all') && (
              <span className="text-brand-400 ml-1">(filtered)</span>
            )}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-12 bg-surface-800 rounded" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <FlaskConical className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400 font-medium">No inspection records</p>
            <p className="text-surface-600 text-sm mt-1">NDE records are added within each weld detail page</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-900/50">
                  {['Weld', 'Project', 'Type', 'Result', 'Inspector', 'Date', 'Report #', 'Defect', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {records.map(r => {
                  const cfg = RESULT_CONFIG[r.result] ?? RESULT_CONFIG.pending
                  return (
                    <tr key={r.id} className="hover:bg-surface-800/30 transition-colors group">
                      <td className="px-4 py-3">
                        {r.weld_id ? (
                          <Link
                            href={`/welds/${r.weld_id}`}
                            className="font-mono text-brand-300 hover:text-brand-200 font-semibold"
                          >
                            {r.welds?.weld_id_number ?? '—'}
                          </Link>
                        ) : (
                          <span className="font-mono text-surface-400">{r.welds?.weld_id_number ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-[120px] truncate">
                        {r.projects?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-semibold text-surface-200">{r.inspection_type}</span>
                          <p className="text-xs text-surface-600 hidden sm:block">
                            {NDE_TYPE_FULL[r.inspection_type] ?? ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs">{r.inspector_name ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400 text-xs whitespace-nowrap">
                        {r.inspection_date
                          ? new Date(r.inspection_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs font-mono">{r.report_number ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.defect_type ? (
                          <div>
                            <span className="text-orange-400">{r.defect_type}</span>
                            {r.defect_location && (
                              <p className="text-surface-600">@ {r.defect_location}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/welds/${r.weld_id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-600 hover:text-brand-400"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Defect summary — only show if there are failures */}
      {records.filter(r => r.result === 'fail' || r.result === 'repair').length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Active Failures &amp; Repairs
          </h3>
          <div className="space-y-2">
            {records
              .filter(r => r.result === 'fail' || r.result === 'repair')
              .slice(0, 10)
              .map(r => {
                const cfg = RESULT_CONFIG[r.result]
                return (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-800/60 border border-surface-700">
                    <span className="font-mono text-sm font-bold text-brand-300 w-20">
                      {r.welds?.weld_id_number ?? '—'}
                    </span>
                    <span className="text-xs font-semibold text-surface-400 w-8">{r.inspection_type}</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color)}>{cfg.label}</span>
                    {r.defect_type && <span className="text-xs text-orange-300">{r.defect_type}</span>}
                    {r.inspector_name && <span className="text-xs text-surface-500 ml-auto">{r.inspector_name}</span>}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
