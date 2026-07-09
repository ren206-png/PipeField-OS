// ============================================================
// Public Share Portal — /share/[token]
// Server component, NO auth required.
// Uses admin client to bypass RLS for public reads.
// ============================================================
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Per-share metadata ─────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  const admin = createAdminClient()
  const { data: link } = await admin
    .from('share_links')
    .select('label, organizations(name)')
    .eq('token', token)
    .maybeSingle()

  if (!link) return { title: 'Project Report' }

  const orgName = (link.organizations as unknown as ShareLinkOrg | null)?.name
  const label   = link.label ?? 'Project Report'

  return {
    title:       orgName ? `${label} — ${orgName}` : label,
    description: `Live project progress report shared by ${orgName ?? 'your team'} via PipeField OS.`,
    robots:      { index: false, follow: false }, // don't index shared reports
  }
}
import { sendShareViewEmail } from '@/lib/email'
import {
  Flame, Package, ShieldCheck, AlertCircle,
  Activity, CheckCircle2, Clock, XCircle, ListChecks,
  MessageSquare, FileText, TrendingUp, CalendarDays,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

/** Supabase join shape returned by `share_links.select('*, organizations(...)')` */
interface ShareLinkOrg {
  id:       string
  name:     string
  logo_url: string | null
}

interface WeldRow {
  id:             string
  weld_id_number: string
  status:         string
  weld_date:      string | null
  welder_name:    string | null
  updated_at:     string
}

interface MilestoneRow {
  id:           string
  name:         string
  planned_date: string | null
  actual_date:  string | null
  status:       string
  sort_order:   number
}

// ── Helpers ───────────────────────────────────────────────────
function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Sub-components ─────────────────────────────────────────────
function StatCard({
  label, value, sub, Icon, color,
}: {
  label: string; value: string | number; sub?: string
  Icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

const weldStatusMeta: Record<string, { label: string; bg: string; text: string }> = {
  in_progress: { label: 'In Progress', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  welded:      { label: 'Welded',      bg: 'bg-blue-50',   text: 'text-blue-700'   },
  nde_pending: { label: 'NDE Pending', bg: 'bg-purple-50', text: 'text-purple-700' },
  nde_pass:    { label: 'NDE Pass',    bg: 'bg-green-50',  text: 'text-green-700'  },
  nde_fail:    { label: 'NDE Fail',    bg: 'bg-red-50',    text: 'text-red-700'    },
  accepted:    { label: 'Accepted',    bg: 'bg-emerald-50',text: 'text-emerald-700'},
  rejected:    { label: 'Rejected',    bg: 'bg-red-50',    text: 'text-red-700'    },
}

const milestoneMeta: Record<string, { Icon: React.ElementType; color: string }> = {
  complete:    { Icon: CheckCircle2, color: 'text-green-500'  },
  in_progress: { Icon: Clock,        color: 'text-blue-500'   },
  delayed:     { Icon: XCircle,      color: 'text-red-500'    },
  pending:     { Icon: Clock,        color: 'text-gray-400'   },
}

// ── Page ──────────────────────────────────────────────────────
export default async function SharePortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  // Fetch the share link
  const { data: link, error: linkErr } = await admin
    .from('client_share_links')
    .select(`
      id, token, label, expires_at, project_id, created_by, views,
      organizations ( id, name, logo_url )
    `)
    .eq('token', token)
    .maybeSingle()

  if (linkErr || !link) notFound()

  // Check expiry
  const isExpired = link.expires_at
    ? new Date(link.expires_at) < new Date()
    : false

  // ── Log view + notify creator (non-blocking, only for valid links) ──
  const headersList = await headers()
  const viewerIp = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  const viewerUa = headersList.get('user-agent') ?? null

  // Fire-and-forget — don't block page render. Skip for expired links.
  if (!isExpired) {
    void (async () => {
      try {
        // 1. Insert view record
        await admin.from('share_link_views').insert({
          share_link_id: link.id,
          viewer_ip: viewerIp,
          viewer_ua: viewerUa,
        })

        // 2. Atomic view count increment (best-effort)
        const rpcResult = await admin.rpc('increment_share_link_views' as never, { link_id: link.id })
        if (rpcResult.error) {
          await admin
            .from('client_share_links')
            .update({ views: ((link as Record<string, unknown>).views as number ?? 0) + 1 })
            .eq('id', link.id)
        }

        // 3. Email the creator (if we can look up their email)
        if (link.created_by) {
          const { data: creator } = await admin.auth.admin.getUserById(link.created_by)
          const creatorEmail = creator?.user?.email
          if (creatorEmail) {
            // Prefer the linked project name; fall back to org name
            const org = link.organizations as unknown as ShareLinkOrg | null  // Supabase join
            const linkedProject = link.project_id
              ? await admin.from('projects').select('name').eq('id', link.project_id).maybeSingle()
              : null
            const projectName =
              (linkedProject?.data as { name: string } | null)?.name ??
              org?.name ??
              'your project'
            const viewedAt = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC'
            await sendShareViewEmail({
              to: creatorEmail,
              projectName,
              shareLabel: link.label,
              viewedAt,
            }).catch(() => { /* non-fatal */ })
          }
        }
      } catch {
        // Non-fatal — don't block page render
      }
    })()
  }

  // ── Expired guard ──────────────────────────────────────────
  if (isExpired) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">This link has expired</h1>
          <p className="text-gray-500 text-sm">
            The project portal link you followed is no longer active.
            Please contact your project team for an updated link.
          </p>
        </div>
      </main>
    )
  }

  // ── Fetch project data ─────────────────────────────────────
  const projectId = link.project_id

  // Determine which project IDs to query
  let projectIds: string[] = []
  if (projectId) {
    projectIds = [projectId]
  } else {
    // All-projects link — fetch org's projects
    const orgId = (link.organizations as unknown as ShareLinkOrg | null)?.id ?? ''
    const { data: orgProjects } = await admin
      .from('projects')
      .select('id')
      .eq('organization_id', orgId)
    projectIds = (orgProjects ?? []).map((p: { id: string }) => p.id)
  }

  // Fetch the primary project's details (first project if multi)
  const { data: project } = projectId
    ? await admin
        .from('projects')
        .select('id, name, project_number, client_name, status, start_date, end_date, description, location')
        .eq('id', projectId)
        .maybeSingle()
    : { data: null }

  if (!projectIds.length) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-gray-400">No project data available.</p>
      </main>
    )
  }

  // Parallel data fetch
  const [weldsRes, milestonesRes, rfisRes, ncrsRes, itpsRes] = await Promise.all([
    admin
      .from('welds')
      .select('id, weld_id_number, status, weld_date, welder_name, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false }),

    projectId
      ? admin
          .from('project_milestones')
          .select('id, name, planned_date, actual_date, status, sort_order')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
          .order('planned_date', { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    admin
      .from('rfis')
      .select('id, status')
      .in('project_id', projectIds),

    admin
      .from('ncrs')
      .select('id, status')
      .in('project_id', projectIds),

    admin
      .from('itps')
      .select('id, status')
      .in('project_id', projectIds),
  ])

  const welds      = (weldsRes.data      ?? []) as WeldRow[]
  const milestones = (milestonesRes.data ?? []) as MilestoneRow[]
  const rfis       = rfisRes.data  ?? []
  const ncrs       = ncrsRes.data  ?? []
  const itps       = itpsRes.data  ?? []

  // ── Weld stats ─────────────────────────────────────────────
  const totalWelds    = welds.length
  const accepted      = welds.filter(w => ['accepted', 'nde_pass'].includes(w.status)).length
  const failed        = welds.filter(w => ['nde_fail', 'rejected'].includes(w.status)).length
  const inProgress    = welds.filter(w => w.status === 'in_progress').length
  const weldPct       = pct(accepted, totalWelds)

  // ── Document stats ─────────────────────────────────────────
  const openRfis  = rfis.filter(r => !['answered', 'closed', 'void'].includes(r.status)).length
  const openNcrs  = ncrs.filter(n => !['closed', 'void'].includes(n.status)).length
  const itpsDone  = itps.filter(i => i.status === 'approved' || i.status === 'complete').length

  // ── Recent activity (last 10) ──────────────────────────────
  const recentWelds = welds.slice(0, 10)

  // ── Organisation ──────────────────────────────────────────
  const org = link.organizations as unknown as ShareLinkOrg | null

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo / brand mark */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Powered by</p>
              <p className="text-sm font-bold text-gray-800 leading-tight">PipeField OS</p>
            </div>
          </div>

          {org && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Project by</p>
              <p className="text-sm font-semibold text-gray-700">{org.name}</p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Portal title ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{link.label}</h1>
          {project && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {project.project_number && (
                <span className="font-mono text-gray-400">{project.project_number}</span>
              )}
              {project.client_name && <span>Client: {project.client_name}</span>}
              {project.location    && <span>{project.location}</span>}
              {project.end_date    && (
                <span>Target: {fmt(project.end_date)}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Weld stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Welds"
            value={totalWelds}
            Icon={Flame}
            color="bg-orange-50 text-orange-500"
          />
          <StatCard
            label="Accepted"
            value={accepted}
            sub={`${weldPct}% complete`}
            Icon={CheckCircle2}
            color="bg-green-50 text-green-500"
          />
          <StatCard
            label="Failed / Rejected"
            value={failed}
            Icon={XCircle}
            color="bg-red-50 text-red-500"
          />
          <StatCard
            label="In Progress"
            value={inProgress}
            Icon={Clock}
            color="bg-blue-50 text-blue-500"
          />
        </div>

        {/* ── Weld completion bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-700">Weld Completion</h2>
            <span className="ml-auto text-sm font-bold text-gray-900">{weldPct}%</span>
          </div>
          <Bar value={weldPct} color="bg-orange-500" />
          <p className="text-xs text-gray-400 mt-2">
            {accepted} of {totalWelds} welds accepted
          </p>
        </div>

        {/* ── Document counts ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="ITPs Complete"
            value={itpsDone}
            sub={`of ${itps.length} total`}
            Icon={FileText}
            color="bg-indigo-50 text-indigo-500"
          />
          <StatCard
            label="Open RFIs"
            value={openRfis}
            Icon={MessageSquare}
            color={openRfis > 0 ? 'bg-yellow-50 text-yellow-500' : 'bg-gray-50 text-gray-400'}
          />
          <StatCard
            label="Open NCRs"
            value={openNcrs}
            Icon={AlertCircle}
            color={openNcrs > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}
          />
        </div>

        {/* ── Milestone timeline ── */}
        {milestones.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-700">Milestone Progress</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {milestones.map(m => {
                const meta = milestoneMeta[m.status] ?? milestoneMeta['pending']
                return (
                  <li key={m.id} className="flex items-center gap-4 px-6 py-3.5">
                    <meta.Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {m.actual_date
                          ? `Completed ${fmt(m.actual_date)}`
                          : m.planned_date
                          ? `Planned ${fmt(m.planned_date)}`
                          : 'No date set'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                      m.status === 'complete'    ? 'bg-green-50 text-green-700'   :
                      m.status === 'in_progress' ? 'bg-blue-50 text-blue-700'    :
                      m.status === 'delayed'     ? 'bg-red-50 text-red-700'      :
                                                   'bg-gray-100 text-gray-500'
                    }`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* ── Recent weld activity ── */}
        {recentWelds.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-700">Recent Weld Activity</h2>
              <span className="ml-auto text-xs text-gray-400">Last {recentWelds.length} updates</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {recentWelds.map(w => {
                const meta = weldStatusMeta[w.status]
                return (
                  <li key={w.id} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Flame className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-800">{w.weld_id_number}</span>
                        {w.welder_name && (
                          <span className="text-xs text-gray-400 ml-2">by {w.welder_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {w.weld_date && (
                        <span className="text-xs text-gray-400 hidden sm:block">{fmt(w.weld_date)}</span>
                      )}
                      {meta ? (
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                          {w.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="pt-4 pb-8 text-center">
          <p className="text-xs text-gray-300">
            This is a read-only project portal shared via PipeField OS.
            {link.expires_at && (
              <> Expires {fmt(link.expires_at)}.</>
            )}
          </p>
        </footer>
      </div>
    </main>
  )
}
