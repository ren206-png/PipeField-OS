// ============================================================
// Dashboard — Phase 5: Live command center
// Server Component — all data fetched at request time.
// ============================================================
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Flame, CheckCircle2, XCircle, Package,
  TrendingUp, Clock, AlertTriangle, FolderKanban,
  ChevronRight, PlusCircle, Edit3, ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { WELD_STATUS_LABELS, SPOOL_STATUS_LABELS, DFR_STATUS_COLORS, DFR_STATUS_LABELS, type WeldStatus, type SpoolStatus, type DfrStatus } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner'
import { CertExpiryBanner } from '@/components/welders/CertExpiryBanner'
import { WelderRiskWidget } from '@/components/dashboard/WelderRiskWidget'

export const metadata: Metadata = { title: 'Dashboard — PipeField OS' }

// ── helpers ─────────────────────────────────────────────────

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

// ── page ────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  // ── current user greeting ─────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = user
    ? await supabase.from('user_profiles').select('full_name, organization_id').eq('auth_user_id', user.id).single()
    : { data: null }
  const firstName = userProfile?.full_name?.split(' ')[0] ?? ''
  const orgId = userProfile?.organization_id ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // ── fetch everything in parallel ──────────────────────────
  const [
    weldsRes,
    spoolsRes,
    projectsRes,
    activityRes,
    expiringWeldersRes,
    todayDfrsRes,
    ndeRes,
    punchRes,
    rfisRes,
    stpRes,
  ] = await Promise.all([
    supabase.from('welds').select('id, status, welder_stamp, welder_name, weld_date, project_id, weld_id_number, created_at'),
    supabase.from('spools').select('id, status, spool_number, project_id, priority, required_date'),
    supabase.from('projects').select('id, name, status'),
    supabase
      .from('audit_logs')
      .select('id, action, table_name, record_id, new_values, previous_values, performed_at')
      .order('performed_at', { ascending: false })
      .limit(12),
    supabase
      .from('welders')
      .select('id, full_name, cert_expiry')
      .not('cert_expiry', 'is', null)
      .lte('cert_expiry', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .gte('cert_expiry', new Date().toISOString().split('T')[0])
      .eq('is_active', true),
    supabase
      .from('daily_field_reports')
      .select('id, report_number, report_date, status, project_id, crew_size, welds_completed, project:projects(name)')
      .eq('report_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('nde_inspections').select('id, result'),
    supabase.from('punch_items').select('id, status, category'),
    supabase.from('rfis').select('id, status'),
    supabase.from('system_turnover_packages').select('id, status'),
  ])

  // ── onboarding checks ────────────────────────────────────
  const [hasProjects, hasWelders, hasWelds, hasTeamMembers] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).limit(1),
    supabase.from('welders').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).limit(1),
    supabase.from('welds').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).limit(1),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gt('created_at', new Date(0).toISOString()).limit(2),
  ])

  const onboarding = {
    createProject:    (hasProjects.count    ?? 0) > 0,
    addWelder:        (hasWelders.count     ?? 0) > 0,
    logFirstWeld:     (hasWelds.count       ?? 0) > 0,
    inviteTeamMember: (hasTeamMembers.count ?? 0) > 1,
  }
  const onboardingComplete = Object.values(onboarding).every(Boolean)

  const welds           = weldsRes.data           ?? []
  const spools          = spoolsRes.data          ?? []
  const projects        = projectsRes.data        ?? []
  const activity        = activityRes.data        ?? []
  const expiringWelders = expiringWeldersRes.data ?? []
  const todayDfrs       = todayDfrsRes.data       ?? []

  // ── NDE stats ─────────────────────────────────────────────
  interface NdeStat { id: string; result: string }
  const ndeAll      = (ndeRes.data ?? []) as NdeStat[]
  const ndePass     = ndeAll.filter((n) => n.result === 'pass').length
  const ndeFail     = ndeAll.filter((n) => n.result === 'fail').length
  const ndePending  = ndeAll.filter((n) => n.result === 'pending').length
  const ndePassRate = (ndeAll.length - ndePending) > 0 ? Math.round((ndePass / (ndeAll.length - ndePending)) * 100) : 0

  // ── Punch + RFI open counts ────────────────────────────────
  interface PunchStat { id: string; status: string; category: string }
  const punchAll     = (punchRes.data ?? []) as PunchStat[]
  const openPunch    = punchAll.filter((p) => !['complete','accepted'].includes(p.status)).length
  const catAPunch    = punchAll.filter((p) => p.category === 'A' && !['complete','accepted'].includes(p.status)).length
  interface RfiStat { id: string; status: string }
  const rfisAll      = (rfisRes.data ?? []) as RfiStat[]
  const openRfis     = rfisAll.filter((r) => !['answered','closed','void'].includes(r.status)).length

  // ── Commissioning stats ────────────────────────────────────
  interface StpStat { id: string; status: string }
  const stpAll      = (stpRes.data ?? []) as StpStat[]
  const stpAccepted = stpAll.filter((s) => s.status === 'accepted').length
  const stpActive   = stpAll.filter((s) => ['pre_comm_in_progress','pre_comm_complete','comm_in_progress','comm_complete'].includes(s.status)).length

  // ── weld stats ────────────────────────────────────────────
  const weldTotal    = welds.length
  const weldAccepted = welds.filter(w => w.status === 'accepted').length
  const weldFailed   = welds.filter(w => w.status === 'failed').length
  const weldActive   = welds.filter(w => ['welded', 'fit_up_approved', 'visual_pass', 'repaired'].includes(w.status)).length
  const passRate     = pct(weldAccepted, weldTotal - weldFailed > 0 ? weldTotal - weldFailed : weldTotal)

  // Weld counts by status
  const weldByStatus: Record<string, number> = {}
  for (const w of welds) {
    weldByStatus[w.status] = (weldByStatus[w.status] ?? 0) + 1
  }

  // ── spool stats ───────────────────────────────────────────
  const spoolTotal    = spools.length
  const spoolReleased = spools.filter(s => s.status === 'released').length
  const spoolByStatus: Record<string, number> = {}
  for (const s of spools) {
    spoolByStatus[s.status] = (spoolByStatus[s.status] ?? 0) + 1
  }

  // ── project stats ─────────────────────────────────────────
  const activeProjects = projects.filter(p => p.status === 'active').length

  // ── welder performance ────────────────────────────────────
  // Group welds by welder stamp
  const welderMap = new Map<string, { name: string; total: number; accepted: number; failed: number }>()
  for (const w of weldsRes.data ?? []) {
    if (!w.welder_stamp) continue
    const key = w.welder_stamp
    if (!welderMap.has(key)) {
      welderMap.set(key, { name: w.welder_name ?? '—', total: 0, accepted: 0, failed: 0 })
    }
    const entry = welderMap.get(key)!
    entry.total++
    if (w.status === 'accepted') entry.accepted++
    if (w.status === 'failed')   entry.failed++
  }
  const welders = Array.from(welderMap.entries())
    .map(([stamp, v]) => ({ stamp, ...v, rate: pct(v.accepted, v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // ── per-project weld progress ─────────────────────────────
  const projectWeldMap = new Map<string, { total: number; accepted: number; name: string }>()
  for (const p of projects) {
    projectWeldMap.set(p.id, { total: 0, accepted: 0, name: p.name })
  }
  for (const w of welds) {
    if (!projectWeldMap.has(w.project_id)) continue
    const entry = projectWeldMap.get(w.project_id)!
    entry.total++
    if (w.status === 'accepted') entry.accepted++
  }
  const projectProgress = Array.from(projectWeldMap.entries())
    .map(([id, v]) => ({ id, ...v, pct: pct(v.accepted, v.total) }))
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // ── last 7 days production ────────────────────────────────
  const dayLabels: string[] = []
  const dayWeldCounts: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    dayLabels.push(iso.slice(5)) // MM-DD
    dayWeldCounts.push(welds.filter(w => w.weld_date === iso).length)
  }
  const maxDay = Math.max(...dayWeldCounts, 1)

  // ── urgent spools (priority 1-2, not released) ────────────
  const urgentSpools = spools
    .filter(s => s.priority != null && s.priority <= 2 && s.status !== 'released')
    .slice(0, 3)

  // ── overdue spools (required_date < today & not completed/released) ──
  const todayStr = new Date().toISOString().split('T')[0]
  const overdueSpools = spools.filter(
    s => s.required_date && s.required_date < todayStr && !['released'].includes(s.status)
  ).length

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* ── Onboarding checklist banner ── */}
      {!onboardingComplete && (
        <OnboardingBanner steps={onboarding} />
      )}

      {/* ── Cert expiry banner (new certifications table) ── */}
      <CertExpiryBanner />

      {/* ── Greeting banner ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">{todayLabel} · Real-time project overview</p>
        </div>
      </div>

      {/* ── Critical alerts row ── */}
      {(overdueSpools > 0 || ndeFail > 0 || openPunch > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdueSpools > 0 && (
            <Link href="/spools" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overdueSpools} Overdue Spool{overdueSpools !== 1 ? 's' : ''}
            </Link>
          )}
          {ndeFail > 0 && (
            <Link href="/nde-tracker" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors">
              <XCircle className="w-3.5 h-3.5" />
              {ndeFail} NDE Failure{ndeFail !== 1 ? 's' : ''}
            </Link>
          )}
          {openPunch > 0 && (
            <Link href="/punch-list" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              {openPunch} Open NCR{openPunch !== 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* ── Quick action buttons ── */}
      <div className="flex flex-wrap gap-2">
        <Link href="/welds/new" className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5">
          <Flame className="w-3.5 h-3.5" /> + New Weld
        </Link>
        <Link href="/spools/new" className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-1.5">
          <Package className="w-3.5 h-3.5" /> + New Spool
        </Link>
        <Link href="/daily-reports/new" className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> + Daily Report
        </Link>
        <Link href="/reports" className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Run QA Package
        </Link>
      </div>

      {/* ── Cert expiry alert banner ── */}
      {expiringWelders.length > 0 && (() => {
        const count = expiringWelders.length
        const names = expiringWelders.map((w) => (w as { full_name: string }).full_name).join(', ')
        return (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Welder Certifications Expiring Soon</p>
              <p className="text-sm text-amber-400/80 mt-0.5">
                {count} welder{count !== 1 ? 's' : ''} — {names} — expire within 30 days.
                <Link href="/welders" className="underline ml-1">Review certifications →</Link>
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Open issues alert ── */}
      {(catAPunch > 0 || openRfis > 0 || ndeFail > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {catAPunch > 0 && (
            <Link href="/punch-list" className="flex items-center gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/25 hover:bg-red-500/12 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">{catAPunch} Cat-A Punch Item{catAPunch !== 1 ? 's' : ''}</p>
                <p className="text-xs text-red-400/70">Must fix before handover</p>
              </div>
            </Link>
          )}
          {ndeFail > 0 && (
            <Link href="/nde-tracker" className="flex items-center gap-3 p-4 rounded-xl bg-orange-500/8 border border-orange-500/25 hover:bg-orange-500/12 transition-colors">
              <XCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-300">{ndeFail} NDE Failure{ndeFail !== 1 ? 's' : ''}</p>
                <p className="text-xs text-orange-400/70">Repair or retest required</p>
              </div>
            </Link>
          )}
          {openRfis > 0 && (
            <Link href="/documents/rfis" className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/8 border border-yellow-500/25 hover:bg-yellow-500/12 transition-colors">
              <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-300">{openRfis} Open RFI{openRfis !== 1 ? 's' : ''}</p>
                <p className="text-xs text-yellow-400/70">Awaiting response</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── KPI stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Total Welds',     value: weldTotal,      icon: Flame,        bg: 'bg-brand-500/10',   color: 'text-brand-400'  },
          { label: 'Accepted',        value: weldAccepted,   icon: CheckCircle2, bg: 'bg-green-500/10',   color: 'text-green-400'  },
          { label: 'Active',          value: weldActive,     icon: Clock,        bg: 'bg-blue-500/10',    color: 'text-blue-400'   },
          { label: 'Failed',          value: weldFailed,     icon: XCircle,      bg: 'bg-red-500/10',     color: 'text-red-400'    },
          { label: 'Total Spools',    value: spoolTotal,     icon: Package,      bg: 'bg-orange-500/10',  color: 'text-orange-400' },
          { label: 'Active Projects', value: activeProjects, icon: FolderKanban, bg: 'bg-purple-500/10',  color: 'text-purple-400' },
          { label: 'NDE Pass Rate',   value: `${ndePassRate}%`, icon: TrendingUp, bg: 'bg-teal-500/10',   color: 'text-teal-400'   },
          { label: 'Open Punch',      value: openPunch,      icon: AlertTriangle, bg: openPunch > 0 ? 'bg-red-500/10' : 'bg-surface-700', color: openPunch > 0 ? 'text-red-400' : 'text-surface-500' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="card p-3 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-surface-50 leading-none">{value}</p>
              <p className="text-[10px] text-surface-500 mt-0.5 leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── NDE + Commissioning mini-panels ── */}
      {(ndeAll.length > 0 || stpAll.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ndeAll.length > 0 && (
            <Link href="/nde-tracker" className="card p-4 hover:border-surface-600 transition-colors block">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-200">NDE Overview</h3>
                <span className="text-xs text-brand-400 hover:text-brand-300">View all →</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-surface-500">Pass rate</span>
                    <span className="font-semibold text-surface-300">{ndePassRate}%</span>
                  </div>
                  <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${ndePassRate}%` }} />
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <div className="text-center"><p className="font-bold text-green-400">{ndePass}</p><p className="text-surface-600">pass</p></div>
                  <div className="text-center"><p className="font-bold text-red-400">{ndeFail}</p><p className="text-surface-600">fail</p></div>
                  <div className="text-center"><p className="font-bold text-surface-400">{ndePending}</p><p className="text-surface-600">pending</p></div>
                </div>
              </div>
            </Link>
          )}
          {stpAll.length > 0 && (
            <Link href="/commissioning" className="card p-4 hover:border-surface-600 transition-colors block">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-200">Commissioning</h3>
                <span className="text-xs text-brand-400">View all →</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-surface-500">Accepted</span>
                    <span className="font-semibold text-surface-300">{stpAccepted}/{stpAll.length}</span>
                  </div>
                  <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${stpAll.length > 0 ? Math.round(stpAccepted / stpAll.length * 100) : 0}%` }} />
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <div className="text-center"><p className="font-bold text-green-400">{stpAccepted}</p><p className="text-surface-600">accepted</p></div>
                  <div className="text-center"><p className="font-bold text-brand-400">{stpActive}</p><p className="text-surface-600">active</p></div>
                  <div className="text-center"><p className="font-bold text-surface-400">{stpAll.length - stpAccepted - stpActive}</p><p className="text-surface-600">pending</p></div>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Weld status breakdown */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-surface-100">Weld Status Breakdown</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-surface-500">Pass rate:</span>
                <span className={`font-bold ${passRate >= 95 ? 'text-green-400' : passRate >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {passRate}%
                </span>
              </div>
            </div>

            {weldTotal === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-surface-600">No welds logged yet.</p>
                <Link href="/welds/new" className="btn-primary mt-3 inline-flex text-sm">Log First Weld</Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {(Object.keys(WELD_STATUS_LABELS) as WeldStatus[]).map(s => {
                  const count = weldByStatus[s] ?? 0
                  const width = pct(count, weldTotal)
                  const barColors: Record<WeldStatus, string> = {
                    draft:           'bg-surface-500',
                    fit_up_approved: 'bg-blue-500',
                    welded:          'bg-brand-500',
                    visual_pass:     'bg-green-500',
                    xray_pending:    'bg-yellow-500',
                    failed:          'bg-red-500',
                    repaired:        'bg-purple-500',
                    accepted:        'bg-emerald-500',
                  }
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="text-xs text-surface-500 w-28 flex-shrink-0 text-right">
                        {WELD_STATUS_LABELS[s]}
                      </span>
                      <div className="flex-1 h-5 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColors[s]} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(width, count > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-surface-300 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Today&apos;s Field Reports */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-surface-100 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-400" />
                Today&apos;s Field Reports
              </h2>
              <Link href="/daily-reports" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                All reports <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {todayDfrs.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-surface-600">No field report logged today.</p>
                <Link href="/daily-reports/new" className="btn-primary mt-3 inline-flex text-sm">
                  Log Today&apos;s Report →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {(todayDfrs as unknown as Array<{
                  id: string; report_number: string; status: string
                  crew_size: number; welds_completed: number
                  project: { name: string } | null
                }>).map(dfr => (
                  <Link
                    key={dfr.id}
                    href={`/daily-reports/${dfr.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-surface-200">{dfr.report_number}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {dfr.project?.name ?? '—'} · {dfr.crew_size} crew · {dfr.welds_completed} welds
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${DFR_STATUS_COLORS[dfr.status as DfrStatus]}`}>
                      {DFR_STATUS_LABELS[dfr.status as DfrStatus]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 7-day production chart */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-surface-100 mb-5">Daily Welds — Last 7 Days</h2>
            <div className="flex items-end gap-2 h-24">
              {dayWeldCounts.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-surface-300">
                    {count > 0 ? count : ''}
                  </span>
                  <div className="w-full rounded-t-md bg-surface-700 relative overflow-hidden"
                       style={{ height: '64px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-brand-500/80 rounded-t-md transition-all duration-500"
                      style={{ height: `${pct(count, maxDay)}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-600">{dayLabels[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Project weld progress */}
          {projectProgress.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-surface-100">Weld Progress by Project</h2>
                <Link href="/projects" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  All projects <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-4">
                {projectProgress.map(p => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-surface-300 truncate">{p.name}</span>
                      <span className="text-xs font-bold text-surface-400 ml-2 flex-shrink-0">
                        {p.accepted}/{p.total} ({p.pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Welder performance */}
          {welders.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-surface-100">Welder Performance</h2>
                <span className="text-xs text-surface-600">{welders.length} welder{welders.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-surface-600 border-b border-surface-700">
                      <th className="text-left pb-2 font-medium">Stamp</th>
                      <th className="text-left pb-2 font-medium">Name</th>
                      <th className="text-right pb-2 font-medium">Total</th>
                      <th className="text-right pb-2 font-medium">Accepted</th>
                      <th className="text-right pb-2 font-medium">Failed</th>
                      <th className="text-right pb-2 font-medium">Pass %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/60">
                    {welders.map(w => (
                      <tr key={w.stamp} className="hover:bg-surface-700/30 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-brand-300">{w.stamp}</td>
                        <td className="py-2.5 text-surface-300">{w.name}</td>
                        <td className="py-2.5 text-right text-surface-300">{w.total}</td>
                        <td className="py-2.5 text-right text-green-400">{w.accepted}</td>
                        <td className="py-2.5 text-right text-red-400">{w.failed}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-bold text-xs ${
                            w.rate >= 95 ? 'text-green-400' :
                            w.rate >= 85 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {w.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* Quick actions */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-surface-100 mb-4">Quick Actions</h2>
            <div className="space-y-1">
              {[
                { label: 'Log New Weld',    href: '/welds/new',    icon: Flame,        color: 'text-brand-400 bg-brand-500/10'  },
                { label: 'New Spool',       href: '/spools/new',   icon: Package,      color: 'text-orange-400 bg-orange-500/10'},
                { label: 'New Project',     href: '/projects/new', icon: FolderKanban, color: 'text-purple-400 bg-purple-500/10'},
                { label: 'Run Calculator',  href: '/calculator',   icon: TrendingUp,   color: 'text-green-400 bg-green-500/10'  },
                { label: 'Generate Report', href: '/reports',      icon: AlertTriangle,color: 'text-yellow-400 bg-yellow-500/10'},
              ].map(a => {
                const Icon = a.icon
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-700/50 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors font-medium">
                      {a.label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-surface-700 group-hover:text-surface-500 ml-auto transition-colors" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Spool pipeline */}
          {spoolTotal > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-surface-100">Spool Pipeline</h2>
                <Link href="/spools" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {(Object.keys(SPOOL_STATUS_LABELS) as SpoolStatus[]).map(s => {
                  const count = spoolByStatus[s] ?? 0
                  if (count === 0) return null
                  const dotColors: Record<SpoolStatus, string> = {
                    designed:          'bg-surface-500',
                    material_released: 'bg-blue-400',
                    cut:               'bg-orange-400',
                    fit_up:            'bg-brand-400',
                    welded:            'bg-yellow-400',
                    nde:               'bg-purple-400',
                    painted:           'bg-pink-400',
                    released:          'bg-emerald-400',
                  }
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors[s]}`} />
                      <span className="text-xs text-surface-400 flex-1">{SPOOL_STATUS_LABELS[s]}</span>
                      <span className="text-xs font-semibold text-surface-300">{count}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-surface-700/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-surface-600">Released</span>
                  <span className="font-bold text-emerald-400">
                    {spoolReleased}/{spoolTotal} ({pct(spoolReleased, spoolTotal)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${pct(spoolReleased, spoolTotal)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Welder risk monitor */}
          <WelderRiskWidget />

          {/* Urgent spools */}
          {urgentSpools.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-surface-100 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Urgent Spools
              </h2>
              <div className="space-y-2">
                {urgentSpools.map((s) => (
                  <Link
                    key={s.id}
                    href={`/spools/${s.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-700/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-mono font-semibold text-surface-200">{s.spool_number}</p>
                      {s.required_date && (
                        <p className="text-xs text-red-400/80">Due {s.required_date}</p>
                      )}
                    </div>
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">P{s.priority}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-surface-100 mb-4">Recent Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-surface-600 text-center py-4">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((entry) => {
                  const isCreate = entry.action === 'INSERT'
                  const newVals  = entry.new_values as Record<string, unknown> | null
                  const prevVals = entry.previous_values as Record<string, unknown> | null

                  let description = isCreate ? `New ${entry.table_name.replace('_', ' ')} created` : `${entry.table_name.replace('_', ' ')} updated`
                  if (!isCreate && newVals?.status) {
                    const prevStatus = prevVals?.status as string | undefined
                    const newStatus  = newVals.status as string
                    const labels     = entry.table_name === 'welds' ? WELD_STATUS_LABELS : SPOOL_STATUS_LABELS
                    description      = prevStatus
                      ? `${(labels as Record<string, string>)[prevStatus] ?? prevStatus} → ${(labels as Record<string, string>)[newStatus] ?? newStatus}`
                      : (labels as Record<string, string>)[newStatus] ?? newStatus
                  }

                  return (
                    <div key={entry.id} className="flex items-start gap-3">
                      <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                        ${isCreate ? 'bg-brand-500/20' : 'bg-surface-700'}
                      `}>
                        {isCreate
                          ? <PlusCircle className="w-3.5 h-3.5 text-brand-400" />
                          : <Edit3 className="w-3.5 h-3.5 text-surface-500" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-surface-300 leading-snug truncate">{description}</p>
                        <p className="text-xs text-surface-600 mt-0.5">{formatDateTime(entry.performed_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty state — first time ── */}
      {weldTotal === 0 && spoolTotal === 0 && (
        <div className="text-center py-16 card">
          <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8 text-brand-500" />
          </div>
          <h3 className="text-lg font-semibold text-surface-100 mb-2">Ready to get started?</h3>
          <p className="text-sm text-surface-400 max-w-sm mx-auto mb-6">
            Create your first project, log welds, and track spools. Everything populates here in real time.
          </p>
          <Link href="/projects/new" className="btn-primary inline-flex">
            Create First Project
          </Link>
        </div>
      )}
    </div>
  )
}
