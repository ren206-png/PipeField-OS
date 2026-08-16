'use client'
// ============================================================
// Project Detail — Comprehensive per-project command center
// Tabs: Overview | Welds | Spools | NDE | Commissioning | Documents | Analytics
// ============================================================
import { useState, useEffect } from 'react'
import { MilestonesPanel } from '@/components/projects/MilestonesPanel'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Flame, Package, XCircle,
  AlertCircle, Edit3, ChevronRight, FlaskConical, Zap, FileText,
  Users, Calendar, MapPin, TrendingUp, Activity, AlertTriangle,
  ListChecks, MessageSquare, BarChart3, LineChart, FileDown,
} from 'lucide-react'
import { addRecent } from '@/lib/recent'
import { useProjectAnalytics } from '@/hooks/useProjectAnalytics'
import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
const WeldStatusDonut  = dynamic(() => import('@/components/projects/WeldStatusDonut').then(m => m.WeldStatusDonut),   { loading: () => <LoadingSpinner /> })
const WeldProgressChart = dynamic(() => import('@/components/projects/WeldProgressChart').then(m => m.WeldProgressChart), { loading: () => <LoadingSpinner /> })
const TopWeldersTable  = dynamic(() => import('@/components/projects/TopWeldersTable').then(m => m.TopWeldersTable),   { loading: () => <LoadingSpinner /> })
const ProjectStatsBar  = dynamic(() => import('@/components/projects/ProjectStatsBar').then(m => m.ProjectStatsBar),   { loading: () => <LoadingSpinner /> })
const ProjectHealthScore = dynamic(() => import('@/components/projects/ProjectHealthScore').then(m => m.ProjectHealthScore), { loading: () => <LoadingSpinner /> })

// ── Types ─────────────────────────────────────────────────────
type Tab = 'overview' | 'welds' | 'spools' | 'nde' | 'commissioning' | 'documents' | 'analytics'

interface Weld {
  id: string
  weld_id_number: string
  status: string
  welder_name: string | null
  weld_date: string | null
}

interface Spool {
  id: string
  spool_number: string
  status: string
  line_number: string | null
  priority: number | null
  required_date: string | null
}

interface NdeRecord {
  id: string
  weld_id: string
  inspection_type: string
  result: string
  inspector_name: string | null
  inspection_date: string | null
  report_number: string | null
  defect_type: string | null
  welds?: { weld_id_number: string } | null
}

interface PunchItem {
  id: string
  description: string | null
  status: string
  category: string
  discipline: string | null
}

interface RFI {
  id: string
  rfi_number: string
  title: string
  status: string
  priority: string | null
}

interface StpItem {
  id: string
  status: string
}

interface Stp {
  id: string
  stp_number: string
  system_name: string
  status: string
  precomm_items?: StpItem[]
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',       label: 'Overview',       icon: BarChart3    },
  { id: 'welds',          label: 'Welds',          icon: Flame        },
  { id: 'spools',         label: 'Spools',         icon: Package      },
  { id: 'nde',            label: 'NDE',            icon: FlaskConical },
  { id: 'commissioning',  label: 'Commissioning',  icon: Zap          },
  { id: 'documents',      label: 'Documents',      icon: FileText     },
  { id: 'analytics',      label: 'Analytics',      icon: LineChart    },
]

const WELD_STATUS_COLOR: Record<string, string> = {
  draft:           'bg-surface-700 text-surface-400',
  fit_up_approved: 'bg-blue-500/15 text-blue-300',
  welded:          'bg-brand-500/15 text-brand-300',
  visual_pass:     'bg-teal-500/15 text-teal-300',
  xray_pending:    'bg-purple-500/15 text-purple-300',
  failed:          'bg-red-500/15 text-red-300',
  repaired:        'bg-orange-500/15 text-orange-300',
  accepted:        'bg-green-500/15 text-green-300',
}

const WELD_STATUS_LABEL: Record<string, string> = {
  draft:           'Draft',
  fit_up_approved: 'Fit-Up OK',
  welded:          'Welded',
  visual_pass:     'Visual Pass',
  xray_pending:    'X-Ray Pending',
  failed:          'Failed',
  repaired:        'Repaired',
  accepted:        'Accepted',
}

const SPOOL_STATUS_COLOR: Record<string, string> = {
  designed:          'bg-surface-700 text-surface-400',
  material_released: 'bg-blue-500/15 text-blue-300',
  cut:               'bg-yellow-500/15 text-yellow-300',
  fit_up:            'bg-orange-500/15 text-orange-300',
  welded:            'bg-brand-500/15 text-brand-300',
  nde:               'bg-purple-500/15 text-purple-300',
  painted:           'bg-pink-500/15 text-pink-300',
  released:          'bg-green-500/15 text-green-300',
}

const NDE_RESULT_COLOR: Record<string, string> = {
  pending: 'bg-surface-700 text-surface-400',
  pass:    'bg-green-500/15 text-green-300',
  fail:    'bg-red-500/15 text-red-300',
  repair:  'bg-orange-500/15 text-orange-300',
  retest:  'bg-yellow-500/15 text-yellow-300',
}

const STP_STATUS_COLOR: Record<string, string> = {
  not_started:          'bg-surface-700 text-surface-400',
  pre_comm_in_progress: 'bg-yellow-500/15 text-yellow-300',
  pre_comm_complete:    'bg-blue-500/15 text-blue-300',
  comm_in_progress:     'bg-purple-500/15 text-purple-300',
  comm_complete:        'bg-teal-500/15 text-teal-300',
  accepted:             'bg-green-500/15 text-green-300',
}

const STP_STATUS_LABEL: Record<string, string> = {
  not_started:          'Not Started',
  pre_comm_in_progress: 'Pre-Comm',
  pre_comm_complete:    'Pre-Comm Done',
  comm_in_progress:     'Commissioning',
  comm_complete:        'Comm Done',
  accepted:             'Accepted',
}

// ── Helpers ───────────────────────────────────────────────────
function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function ProgressBar({ value, color = 'bg-brand-500' }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', color)}>{label}</span>
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab({ project, welds, spools, nde, punch, rfis, stps, projectId }: {
  project: Record<string, unknown>; welds: Weld[]; spools: Spool[]; nde: NdeRecord[]; punch: PunchItem[]; rfis: RFI[]; stps: Stp[]; projectId: string
}) {
  const weldAccepted = welds.filter(w => w.status === 'accepted').length
  const weldFailed   = welds.filter(w => w.status === 'failed').length
  const weldActive   = welds.filter(w => !['draft','accepted','failed'].includes(w.status)).length
  const weldPct      = pct(weldAccepted, welds.length)

  const spoolReleased = spools.filter(s => s.status === 'released').length
  const spoolPct      = pct(spoolReleased, spools.length)

  const ndePass     = nde.filter(n => n.result === 'pass').length
  const ndeFail     = nde.filter(n => n.result === 'fail').length
  const ndePending  = nde.filter(n => n.result === 'pending').length
  const ndePassRate = pct(ndePass, nde.length - ndePending || nde.length)

  const openPunch = punch.filter(p => !['complete','accepted'].includes(p.status)).length
  const catAPunch = punch.filter(p => p.category === 'A' && !['complete','accepted'].includes(p.status)).length
  const openRfis  = rfis.filter(r => !['answered','closed','void'].includes(r.status)).length
  const stpAccepted = stps.filter(s => s.status === 'accepted').length

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const iso = d.toISOString().split('T')[0]
    return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), count: welds.filter(w => w.weld_date === iso).length }
  })
  const maxDay = Math.max(...last7.map(d => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Alert bar */}
      {(catAPunch > 0 || ndeFail > 0 || openRfis > 0) && (
        <div className="flex flex-wrap gap-3">
          {catAPunch > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300 font-medium">{catAPunch} Cat-A punch item{catAPunch !== 1 ? 's' : ''}</span>
            </div>
          )}
          {ndeFail > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25">
              <XCircle className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-300 font-medium">{ndeFail} NDE failure{ndeFail !== 1 ? 's' : ''}</span>
            </div>
          )}
          {openRfis > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
              <MessageSquare className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-300 font-medium">{openRfis} open RFI{openRfis !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Weld Progress', value: weldPct, sub: `${weldAccepted}/${welds.length} accepted`, color: 'bg-orange-500', icon: Flame, icolor: 'text-orange-400' },
          { label: 'Spool Progress', value: spoolPct, sub: `${spoolReleased}/${spools.length} released`, color: 'bg-blue-500', icon: Package, icolor: 'text-blue-400' },
          { label: 'NDE Pass Rate', value: ndePassRate, sub: `${ndePass}/${nde.length - ndePending} pass`, color: 'bg-green-500', icon: FlaskConical, icolor: 'text-green-400' },
          { label: 'Commissioning', value: pct(stpAccepted, stps.length), sub: `${stpAccepted}/${stps.length} accepted`, color: 'bg-brand-500', icon: Zap, icolor: 'text-brand-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <s.icon className={cn('w-4 h-4', s.icolor)} />
              <span className="text-xs text-surface-500 font-medium">{s.label}</span>
              <span className="ml-auto text-sm font-bold text-surface-200">{s.value}%</span>
            </div>
            <ProgressBar value={s.value} color={s.color} />
            <p className="text-xs text-surface-600 mt-2">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Health score */}
      <ProjectHealthScore projectId={projectId} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Welds',  value: welds.length,   icon: Flame,        color: 'text-brand-400',  bg: 'bg-brand-500/10'  },
          { label: 'Active Welds', value: weldActive,     icon: Activity,     color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
          { label: 'Failed',       value: weldFailed,     icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10'    },
          { label: 'Total Spools', value: spools.length,  icon: Package,      color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'NDE Records',  value: nde.length,     icon: FlaskConical, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Open Punch',   value: openPunch,      icon: ListChecks,   color: openPunch > 0 ? 'text-yellow-400' : 'text-surface-500', bg: openPunch > 0 ? 'bg-yellow-500/10' : 'bg-surface-700' },
          { label: 'Open RFIs',    value: openRfis,       icon: MessageSquare, color: openRfis > 0 ? 'text-blue-400' : 'text-surface-500', bg: openRfis > 0 ? 'bg-blue-500/10' : 'bg-surface-700' },
          { label: 'STPs',         value: stps.length,    icon: Zap,          color: 'text-teal-400',   bg: 'bg-teal-500/10'  },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={cn('w-4 h-4', s.color)} />
            </div>
            <div>
              <p className="text-xl font-bold text-surface-50 leading-none">{s.value}</p>
              <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 7-day weld bar chart */}
      {welds.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            Last 7 Days — Welds
          </h3>
          <div className="flex items-end gap-2 h-24">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                  <div
                    className="w-full bg-brand-500/60 hover:bg-brand-500 rounded-t transition-colors"
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                    title={`${d.count} welds`}
                  />
                </div>
                <span className="text-[9px] text-surface-600">{d.label}</span>
                {d.count > 0 && <span className="text-[9px] font-semibold text-surface-400">{d.count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Milestones section appended to OverviewTab via wrapper below ──

// ── Welds Tab ─────────────────────────────────────────────────
function WeldsTab({ welds }: { welds: Weld[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = welds.filter(w => {
    if (statusFilter !== 'all' && w.status !== statusFilter) return false
    if (search && !w.weld_id_number?.toLowerCase().includes(search.toLowerCase()) && !w.welder_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statuses = Array.from(new Set(welds.map(w => w.status)))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <input className="input pl-3 w-full" placeholder="Search weld #, welder…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          {statuses.map(s => <option key={s} value={s}>{WELD_STATUS_LABEL[s] ?? s}</option>)}
        </select>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-800 bg-surface-900/50">
              {['Weld #','Status','Welder','Weld Date',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-surface-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-500 text-sm">No welds match filter</td></tr>
              ) : filtered.map((w) => (
                <tr key={w.id} className="hover:bg-surface-800/30 transition-colors group">
                  <td className="px-4 py-3 font-mono font-semibold text-brand-300">{w.weld_id_number}</td>
                  <td className="px-4 py-3"><StatusBadge label={WELD_STATUS_LABEL[w.status] ?? w.status} color={WELD_STATUS_COLOR[w.status] ?? 'bg-surface-700 text-surface-400'} /></td>
                  <td className="px-4 py-3 text-surface-400 text-xs">{w.welder_name ?? '—'}</td>
                  <td className="px-4 py-3 text-surface-400 text-xs">{w.weld_date ? new Date(w.weld_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3"><Link href={`/welds/${w.id}`} className="opacity-0 group-hover:opacity-100 text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1 transition-opacity">View <ChevronRight className="w-3 h-3" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Spools Tab ────────────────────────────────────────────────
function SpoolsTab({ spools }: { spools: Spool[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = statusFilter === 'all' ? spools : spools.filter(s => s.status === statusFilter)
  const statuses = Array.from(new Set(spools.map(s => s.status)))

  return (
    <div className="space-y-4">
      <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="all">All Status</option>
        {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-800 bg-surface-900/50">
              {['Spool #','Line','Status','Priority','Required By',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-surface-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-500 text-sm">No spools</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-surface-800/30 transition-colors group">
                  <td className="px-4 py-3 font-mono font-semibold text-surface-200">{s.spool_number}</td>
                  <td className="px-4 py-3 text-surface-400 text-xs">{s.line_number ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge label={s.status.replace('_',' ')} color={SPOOL_STATUS_COLOR[s.status] ?? 'bg-surface-700 text-surface-400'} /></td>
                  <td className="px-4 py-3 text-xs text-surface-400">{s.priority ? `P${s.priority}` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-surface-400">{s.required_date ? new Date(s.required_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3"><Link href={`/spools/${s.id}`} className="opacity-0 group-hover:opacity-100 text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1 transition-opacity">View <ChevronRight className="w-3 h-3" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── NDE Tab ───────────────────────────────────────────────────
function NdeTab({ nde }: { nde: NdeRecord[] }) {
  const stats = {
    pass: nde.filter(n => n.result === 'pass').length,
    fail: nde.filter(n => n.result === 'fail').length,
    pending: nde.filter(n => n.result === 'pending').length,
    repair: nde.filter(n => n.result === 'repair').length,
  }
  const passRate = pct(stats.pass, nde.length - stats.pending || nde.length)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: nde.length, color: 'text-purple-400' },
          { label: 'Pass',  value: stats.pass, color: 'text-green-400'  },
          { label: 'Fail',  value: stats.fail, color: 'text-red-400'    },
          { label: `Pass Rate`, value: `${passRate}%`, color: passRate >= 95 ? 'text-green-400' : passRate >= 80 ? 'text-yellow-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-800 bg-surface-900/50">
              {['Weld #','Type','Result','Inspector','Date','Report #','Defect'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-surface-800">
              {nde.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-500 text-sm">No NDE records</td></tr>
              ) : nde.map((n) => (
                <tr key={n.id} className="hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3"><Link href={`/welds/${n.weld_id}`} className="font-mono text-brand-300 hover:text-brand-200 font-semibold">{n.welds?.weld_id_number ?? '—'}</Link></td>
                  <td className="px-4 py-3 font-semibold text-surface-200">{n.inspection_type}</td>
                  <td className="px-4 py-3"><StatusBadge label={n.result} color={NDE_RESULT_COLOR[n.result] ?? 'bg-surface-700 text-surface-400'} /></td>
                  <td className="px-4 py-3 text-xs text-surface-400">{n.inspector_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-surface-400">{n.inspection_date ? new Date(n.inspection_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-surface-400">{n.report_number ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-orange-400">{n.defect_type ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Commissioning Tab ─────────────────────────────────────────
function CommissioningTab({ stps, projectId }: { stps: Stp[]; projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/commissioning" className="btn-ghost text-sm flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Manage in Commissioning module
        </Link>
      </div>
      {stps.length === 0 ? (
        <div className="card p-8 text-center">
          <Zap className="w-10 h-10 text-surface-600 mx-auto mb-2" />
          <p className="text-surface-400">No System Turnover Packages created yet</p>
          <Link href="/commissioning" className="btn-primary mt-3 inline-flex items-center gap-2 text-sm">
            <Zap className="w-3.5 h-3.5" /> Go to Commissioning
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stps.map((stp) => {
            const items: StpItem[] = stp.precomm_items ?? []
            const done = items.filter((i) => i.status === 'complete' || i.status === 'na').length
            const pctVal = pct(done, items.length)
            return (
              <Link key={stp.id} href={`/commissioning/${stp.id}`} className="card p-4 hover:border-brand-500/40 transition-all group block">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-mono text-surface-500">{stp.stp_number}</p>
                    <p className="font-semibold text-surface-100 group-hover:text-brand-300 transition-colors">{stp.system_name}</p>
                  </div>
                  <StatusBadge label={STP_STATUS_LABEL[stp.status] ?? stp.status} color={STP_STATUS_COLOR[stp.status] ?? 'bg-surface-700 text-surface-400'} />
                </div>
                {items.length > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-500">Checklist</span>
                      <span className="text-surface-400">{done}/{items.length}</span>
                    </div>
                    <ProgressBar value={pctVal} />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Documents Tab ─────────────────────────────────────────────
interface DocRecord { id: string; title: string; document_type: string | null; status: string | null }
interface NcrRecord { id: string; ncr_number: string; title: string; status: string; severity: string | null }
interface PressureTest { id: string; test_number: string; test_type: string | null; result: string | null }
function DocumentsTab({ docs, rfis, ncrs, pressureTests, punch }: { docs: DocRecord[]; rfis: RFI[]; ncrs: NcrRecord[]; pressureTests: PressureTest[]; punch: PunchItem[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Documents', value: docs.length, href: '/documents', color: 'text-brand-400' },
          { label: 'RFIs', value: rfis.length, href: '/documents/rfis', color: 'text-blue-400' },
          { label: 'NCRs', value: ncrs.length, href: '/documents/ncrs', color: 'text-red-400' },
          { label: 'Pressure Tests', value: pressureTests.length, href: '/documents/pressure-tests', color: 'text-purple-400' },
        ].map(s => (
          <Link key={s.label} href={s.href} className="card p-4 hover:border-surface-600 transition-colors">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      {rfis.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-200">Recent RFIs</h3>
            <Link href="/documents/rfis" className="text-xs text-brand-400">View all →</Link>
          </div>
          <div className="divide-y divide-surface-800">
            {rfis.slice(0, 5).map((r) => (
              <Link key={r.id} href={`/documents/rfis/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-800/20 transition-colors">
                <div>
                  <span className="text-xs font-mono text-surface-400">{r.rfi_number}</span>
                  <p className="text-sm text-surface-200">{r.title}</p>
                </div>
                <StatusBadge label={r.status} color="bg-surface-700 text-surface-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {punch.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-200">Punch List</h3>
            <Link href="/punch-list" className="text-xs text-brand-400">View all →</Link>
          </div>
          <div className="divide-y divide-surface-800">
            {punch.filter(p => !['complete','accepted'].includes(p.status)).slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', p.category === 'A' ? 'bg-red-500/20 text-red-300' : p.category === 'B' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-surface-700 text-surface-400')}>
                    Cat {p.category}
                  </span>
                  <p className="text-sm text-surface-300">{p.description ?? 'No description'}</p>
                </div>
                <StatusBadge label={p.status} color="bg-surface-700 text-surface-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Analytics Tab ─────────────────────────────────────────────
function AnalyticsTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectAnalytics(projectId)

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-5 h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5 h-72" />
          <div className="card p-5 h-72" />
        </div>
        <div className="card p-5 h-48" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-8 h-8 text-surface-600 mx-auto mb-2" />
        <p className="text-surface-500 text-sm">Failed to load analytics</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ProjectStatsBar
        totalWelds={data.totalWelds}
        completionPct={data.completionPct}
        firstPassRate={data.firstPassRate}
        rejectionRate={data.rejectionRate}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WeldStatusDonut data={data.weldsByStatus} completionPct={data.completionPct} />
        <WeldProgressChart data={data.weldsByWeek} />
      </div>
      <TopWeldersTable data={data.topWelders} />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
// Exported as a named export so the server page can import it.
// Receives server-prefetched project data as initialData so the
// header and tabs render immediately with no loading skeleton.
export function ProjectDetailClient({ id, initialData }: {
  id: string
  initialData: Record<string, unknown>
}) {
  const { isOrgAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Load project — initialData from server so first render is instant
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await createClient().from('projects').select('*').eq('id', id).maybeSingle()
      return data
    },
    initialData,
    // Date.now() tells React Query the server data is fresh right now,
    // so it won't immediately fire a background refetch on mount.
    // The global staleTime (60 s) controls when it becomes stale.
    initialDataUpdatedAt: Date.now(),
    staleTime: 60_000,
  })

  // Load all project data in parallel
  // staleTime of 2 min — this query fetches 9 tables and is expensive.
  // refetchOnWindowFocus is disabled so re-focusing the tab doesn't
  // hammer the DB while the user is reviewing data.
  const { data: allData, isLoading: loadingData } = useQuery({
    queryKey: ['project-detail', id],
    enabled: !!id,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const db = createClient()
      const [welds, spools, nde, punch, rfis, ncrs, pressureTests, docs, stps] = await Promise.all([
        db.from('welds').select('id, weld_id_number, status, welder_name, weld_date').eq('project_id', id).order('weld_id_number'),
        db.from('spools').select('id, spool_number, line_number, status, priority, required_date').eq('project_id', id).order('spool_number'),
        db.from('nde_inspections').select('*, welds(weld_id_number)').eq('project_id', id).order('created_at', { ascending: false }),
        db.from('punch_items').select('id, description, status, category, discipline').eq('project_id', id).order('created_at', { ascending: false }),
        db.from('rfis').select('id, rfi_number, title, status, priority').eq('project_id', id).order('created_at', { ascending: false }),
        db.from('ncrs').select('id, ncr_number, title, status, severity').eq('project_id', id).order('created_at', { ascending: false }),
        db.from('pressure_tests').select('id, test_number, test_type, result').eq('project_id', id).order('created_at', { ascending: false }),
        db.from('documents').select('id, title, document_type, status').eq('project_id', id).order('created_at', { ascending: false }),
        db.from('system_turnover_packages').select('*, precomm_items(id, status)').eq('project_id', id).order('stp_number'),
      ])
      return {
        welds: welds.data ?? [],
        spools: spools.data ?? [],
        nde: nde.data ?? [],
        punch: punch.data ?? [],
        rfis: rfis.data ?? [],
        ncrs: ncrs.data ?? [],
        pressureTests: pressureTests.data ?? [],
        docs: docs.data ?? [],
        stps: stps.data ?? [],
      }
    },
  })

  // Track recent view
  useEffect(() => {
    if (project) {
      addRecent({ id: project.id, label: project.name, href: `/projects/${project.id}`, type: 'project', timestamp: Date.now() })
    }
  }, [project])

  if (loadingProject) {
    return (
      <div className="space-y-4 animate-pulse max-w-6xl">
        <div className="h-8 bg-surface-800 rounded w-48" />
        <div className="card p-6 h-32" />
        <div className="card p-6 h-64" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-surface-400">Project not found</p>
        <Link href="/projects" className="btn-ghost mt-3 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
      </div>
    )
  }

  const d = allData ?? { welds: [], spools: [], nde: [], punch: [], rfis: [], ncrs: [], pressureTests: [], docs: [], stps: [] }

  const STATUS_COLOR: Record<string, string> = {
    planning:  'bg-surface-700 text-surface-400',
    active:    'bg-green-500/15 text-green-300',
    on_hold:   'bg-yellow-500/15 text-yellow-300',
    completed: 'bg-blue-500/15 text-blue-300',
    cancelled: 'bg-red-500/15 text-red-300',
  }
  const STATUS_LABEL: Record<string, string> = {
    planning: 'Planning', active: 'Active', on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled',
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Projects
      </Link>

      {/* Project header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              {project.project_number && (
                <span className="text-sm font-mono text-surface-500 bg-surface-800 px-2 py-0.5 rounded">{project.project_number}</span>
              )}
              <StatusBadge label={STATUS_LABEL[project.status] ?? project.status} color={STATUS_COLOR[project.status] ?? 'bg-surface-700 text-surface-400'} />
            </div>
            <h1 className="text-2xl font-bold text-surface-50">{project.name}</h1>
            {project.description && <p className="text-sm text-surface-500 mt-1 max-w-2xl">{project.description}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {project.client_name && (
                <div className="flex items-center gap-1.5 text-sm text-surface-400">
                  <Users className="w-3.5 h-3.5 text-surface-600" />
                  {project.client_name}
                </div>
              )}
              {project.location && (
                <div className="flex items-center gap-1.5 text-sm text-surface-400">
                  <MapPin className="w-3.5 h-3.5 text-surface-600" />
                  {project.location}
                </div>
              )}
              {project.start_date && (
                <div className="flex items-center gap-1.5 text-sm text-surface-400">
                  <Calendar className="w-3.5 h-3.5 text-surface-600" />
                  {new Date(project.start_date).toLocaleDateString()} — {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'Ongoing'}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/api/reports/executive-report?projectId=${project.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <FileDown className="w-4 h-4" /> Export Report
            </a>
            {isOrgAdmin && (
              <Link href={`/projects/${id}/edit`} className="btn-ghost flex items-center gap-2 text-sm">
                <Edit3 className="w-4 h-4" /> Edit Project
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-800 pb-0 -mb-px scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-surface-500 hover:text-surface-300'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.id === 'welds'         && d.welds.length > 0   && <span className="text-xs bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded-full">{d.welds.length}</span>}
            {tab.id === 'spools'        && d.spools.length > 0  && <span className="text-xs bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded-full">{d.spools.length}</span>}
            {tab.id === 'nde'           && d.nde.length > 0     && <span className="text-xs bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded-full">{d.nde.length}</span>}
            {tab.id === 'commissioning' && d.stps.length > 0    && <span className="text-xs bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded-full">{d.stps.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {loadingData ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="card p-5 h-20" />)}
          </div>
        ) : (
          <>
            {activeTab === 'overview'      && (
              <div className="space-y-6">
                <OverviewTab project={project} welds={d.welds} spools={d.spools} nde={d.nde} punch={d.punch} rfis={d.rfis} stps={d.stps} projectId={id} />
                <MilestonesPanel projectId={id} canEdit={true} />
              </div>
            )}
            {activeTab === 'welds'         && <WeldsTab welds={d.welds} />}
            {activeTab === 'spools'        && <SpoolsTab spools={d.spools} />}
            {activeTab === 'nde'           && <NdeTab nde={d.nde} />}
            {activeTab === 'commissioning' && <CommissioningTab stps={d.stps} projectId={id} />}
            {activeTab === 'documents'     && <DocumentsTab docs={d.docs} rfis={d.rfis} ncrs={d.ncrs} pressureTests={d.pressureTests} punch={d.punch} />}
            {activeTab === 'analytics'     && <AnalyticsTab projectId={id} />}
          </>
        )}
      </div>
    </div>
  )
}
