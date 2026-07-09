'use client'
// ============================================================
// Client Portal — Read-only project progress dashboard
// Designed for client_viewer role — no edit capabilities
// ============================================================
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/hooks/useOrganization'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  Building2, Flame, Package, CheckCircle2, AlertCircle, Clock,
  MessageSquare, ListChecks, Activity, TrendingUp,
  ShieldCheck, ChevronRight,
  Link2, Plus, Copy, Trash2, ExternalLink, CalendarClock,
} from 'lucide-react'
import { useShareLinks, useCreateShareLink, useDeleteShareLink } from '@/hooks/useShareLinks'

// ── Metric card ───────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, color = 'text-brand-400', accent = 'bg-brand-500/10',
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color?: string; accent?: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-surface-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-surface-50">{value}</p>
          {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', accent)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────
function ProgressBar({ pct, color = 'bg-brand-500' }: { pct: number; color?: string }) {
  return (
    <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

// ── Project selector card ─────────────────────────────────────
function ProjectCard({ project, selected, onClick }: {
  project: any; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'card p-4 text-left transition-all w-full',
        selected
          ? 'border-brand-500/60 bg-brand-500/5'
          : 'hover:border-surface-600'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-surface-100 text-sm">{project.name}</p>
          {project.project_number && (
            <p className="text-xs text-surface-500 font-mono mt-0.5">{project.project_number}</p>
          )}
          {project.client_name && (
            <p className="text-xs text-surface-500 mt-0.5">{project.client_name}</p>
          )}
        </div>
        <ChevronRight className={cn(
          'w-4 h-4 transition-colors flex-shrink-0',
          selected ? 'text-brand-400' : 'text-surface-600'
        )} />
      </div>
      {project.status && (
        <div className={cn(
          'mt-2 inline-flex text-xs px-2 py-0.5 rounded-full font-medium',
          project.status === 'active'    ? 'bg-green-500/15 text-green-300' :
          project.status === 'completed' ? 'bg-brand-500/15 text-brand-300' :
          project.status === 'on_hold'   ? 'bg-yellow-500/15 text-yellow-300' :
          'bg-surface-700 text-surface-400'
        )}>
          {project.status.replace('_', ' ')}
        </div>
      )}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────
// ── Share Links Panel ─────────────────────────────────────────
function ShareLinksPanel({ projects }: { projects: any[] }) {
  const { data: links = [], isLoading } = useShareLinks()
  const createLink = useCreateShareLink()
  const deleteLink = useDeleteShareLink()
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [projectId, setProjectId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  function baseUrl() {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    await createLink.mutateAsync({
      label:     label.trim(),
      projectId: projectId || null,
      expiresAt: expiresAt || null,
    })
    setLabel('')
    setProjectId('')
    setExpiresAt('')
    setShowForm(false)
  }

  function copyLink(token: string) {
    const url = `${baseUrl()}/share/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-brand-400" />
          Client Share Links
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Link
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 border border-surface-700 rounded-xl p-4 bg-surface-900/50">
          <div>
            <label className="label">Label <span className="text-red-400">*</span></label>
            <input
              className="input w-full"
              placeholder="e.g. Acme Corp — Project Alpha"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project (optional)</label>
              <select
                className="input w-full"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Expires (optional)</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={createLink.isPending} className="btn-primary text-sm">
              {createLink.isPending ? 'Creating…' : 'Create Link'}
            </button>
          </div>
        </form>
      )}

      {/* Links list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-14 bg-surface-800 rounded-xl animate-pulse" />)}
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-8 text-surface-500 text-sm">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No share links yet. Create one to give clients read-only access.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => {
            const url = `${baseUrl()}/share/${link.token}`
            const expired = link.expires_at && new Date(link.expires_at) < new Date()
            return (
              <div
                key={link.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  expired
                    ? 'border-surface-800 bg-surface-900/30 opacity-60'
                    : 'border-surface-700 bg-surface-800/30'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-200 truncate">{link.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {link.projects && (
                      <span className="text-xs text-surface-500">{link.projects.name}</span>
                    )}
                    <span className="text-xs text-surface-600">{link.views} view{link.views !== 1 ? 's' : ''}</span>
                    {link.expires_at && (
                      <span className={cn(
                        'text-xs flex items-center gap-0.5',
                        expired ? 'text-red-400' : 'text-surface-500'
                      )}>
                        <CalendarClock className="w-3 h-3" />
                        {expired ? 'Expired' : `Expires ${new Date(link.expires_at).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-surface-400 hover:text-brand-400 transition-colors"
                    title="Open portal"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => copyLink(link.token)}
                    className="p-1.5 text-surface-400 hover:text-brand-400 transition-colors"
                    title="Copy link"
                  >
                    {copied === link.token ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this share link? The URL will stop working immediately.')) {
                        deleteLink.mutate(link.id)
                      }
                    }}
                    className="p-1.5 text-surface-400 hover:text-red-400 transition-colors"
                    title="Delete link"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function ClientPortalPage() {
  const { organizationId } = useOrganization()
  const { profile } = useAuth()
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  // Load projects
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['client-portal-projects', organizationId],
    staleTime: 5 * 60_000,
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await createClient()
        .from('projects')
        .select('id, name, project_number, client_name, status, start_date, end_date, description, location')
        .eq('organization_id', organizationId!)
        .order('name')
      return data ?? []
    },
  })

  const project = projects.find((p: any) => p.id === selectedProject)

  // Load project metrics
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['client-portal-metrics', selectedProject],
    staleTime: 5 * 60_000,
    enabled: !!selectedProject,
    queryFn: async () => {
      const db = createClient()
      const [welds, spools, rfisRaw, punchRaw, ndeRaw] = await Promise.all([
        db.from('welds').select('id, status').eq('project_id', selectedProject!),
        db.from('spools').select('id, status').eq('project_id', selectedProject!),
        db.from('rfis').select('id, status').eq('project_id', selectedProject!),
        db.from('punch_items').select('id, status, category').eq('project_id', selectedProject!),
        db.from('nde_inspections').select('id, result').eq('project_id', selectedProject!),
      ])
      const weldData  = welds.data  ?? []
      const spoolData = spools.data ?? []
      const rfiData   = rfisRaw.error  ? [] : (rfisRaw.data ?? [])
      const punchData = punchRaw.error ? [] : (punchRaw.data ?? [])
      const ndeData   = ndeRaw.error   ? [] : (ndeRaw.data ?? [])

      const weldComplete  = weldData.filter(w => ['welded','nde_pass','nde_pending','nde_fail'].includes(w.status)).length
      const spoolComplete = spoolData.filter(s => ['complete','installed','tested'].includes(s.status)).length
      const ndePass       = ndeData.filter(n => n.result === 'pass').length
      const ndeTotal      = ndeData.filter(n => n.result !== 'pending').length
      const openPunch     = punchData.filter(p => !['complete','accepted'].includes(p.status)).length
      const catAPunch     = punchData.filter(p => p.category === 'A' && !['complete','accepted'].includes(p.status)).length
      const openRfis      = rfiData.filter(r => !['answered','closed','void'].includes(r.status)).length

      return {
        welds:       { total: weldData.length,  complete: weldComplete  },
        spools:      { total: spoolData.length, complete: spoolComplete },
        nde:         { total: ndeTotal,         pass: ndePass           },
        punch:       { open: openPunch,         catA: catAPunch         },
        rfis:        { open: openRfis                                   },
        weldPct:     weldData.length  > 0 ? Math.round((weldComplete  / weldData.length)  * 100) : 0,
        spoolPct:    spoolData.length > 0 ? Math.round((spoolComplete / spoolData.length) * 100) : 0,
        ndePassRate: ndeTotal > 0 ? Math.round((ndePass / ndeTotal) * 100) : 0,
      }
    },
  })

  // Load recent weld activity
  const { data: recentWelds = [] } = useQuery({
    queryKey: ['client-portal-activity', selectedProject],
    staleTime: 60_000,
    enabled: !!selectedProject,
    queryFn: async () => {
      const { data } = await createClient()
        .from('welds')
        .select('id, weld_id_number, status, weld_date, welder_name, updated_at')
        .eq('project_id', selectedProject!)
        .neq('status', 'not_welded')
        .order('updated_at', { ascending: false })
        .limit(8)
      return data ?? []
    },
  })

  const weldStatusColor: Record<string, string> = {
    in_progress: 'bg-yellow-500/15 text-yellow-300',
    welded:      'bg-blue-500/15 text-blue-300',
    nde_pending: 'bg-purple-500/15 text-purple-300',
    nde_pass:    'bg-green-500/15 text-green-300',
    nde_fail:    'bg-red-500/15 text-red-300',
    rejected:    'bg-red-500/15 text-red-400',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Client Portal</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Real-time project progress — read-only view for {profile?.full_name ?? 'client'}
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Project list */}
        <div className="w-64 flex-shrink-0 space-y-2">
          <p className="text-xs text-surface-500 font-medium uppercase tracking-wider px-1 mb-3">Projects</p>
          {loadingProjects ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="card p-4 h-16 animate-pulse" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="card p-4 text-center">
              <p className="text-surface-500 text-xs">No projects available</p>
            </div>
          ) : (
            projects.map((p: any) => (
              <ProjectCard
                key={p.id}
                project={p}
                selected={selectedProject === p.id}
                onClick={() => setSelectedProject(p.id)}
              />
            ))
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {!selectedProject ? (
            <div className="card p-12 text-center">
              <Building2 className="w-12 h-12 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 font-medium">Select a project to view progress</p>
            </div>
          ) : loadingMetrics ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="card p-5 h-24" />)}
              </div>
              <div className="card p-6 h-48" />
            </div>
          ) : (
            <>
              {/* Project header */}
              {project && (
                <div className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-surface-50">{project.name}</h2>
                      {project.client_name && (
                        <p className="text-sm text-surface-400 mt-0.5">Client: {project.client_name}</p>
                      )}
                      {project.description && (
                        <p className="text-sm text-surface-500 mt-2 max-w-lg">{project.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {project.end_date && (
                        <div>
                          <p className="text-xs text-surface-500">Target Completion</p>
                          <p className="text-sm font-semibold text-surface-200 mt-0.5">
                            {new Date(project.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {project.location && (
                        <p className="text-xs text-surface-500 mt-2">{project.location}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Key metrics */}
              {metrics && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetricCard
                      label="Welds Complete"
                      value={`${metrics.welds.complete}/${metrics.welds.total}`}
                      sub={`${metrics.weldPct}% complete`}
                      icon={Flame}
                      color="text-orange-400"
                      accent="bg-orange-500/10"
                    />
                    <MetricCard
                      label="Spools Complete"
                      value={`${metrics.spools.complete}/${metrics.spools.total}`}
                      sub={`${metrics.spoolPct}% complete`}
                      icon={Package}
                      color="text-blue-400"
                      accent="bg-blue-500/10"
                    />
                    <MetricCard
                      label="NDE Pass Rate"
                      value={`${metrics.ndePassRate}%`}
                      sub={`${metrics.nde.pass}/${metrics.nde.total} inspections`}
                      icon={ShieldCheck}
                      color="text-green-400"
                      accent="bg-green-500/10"
                    />
                    <MetricCard
                      label="Open Items"
                      value={metrics.punch.open + metrics.rfis.open}
                      sub={`${metrics.punch.catA} Cat-A punch, ${metrics.rfis.open} RFI${metrics.rfis.open !== 1 ? 's' : ''}`}
                      icon={AlertCircle}
                      color={metrics.punch.catA > 0 ? 'text-red-400' : 'text-yellow-400'}
                      accent={metrics.punch.catA > 0 ? 'bg-red-500/10' : 'bg-yellow-500/10'}
                    />
                  </div>

                  {/* Progress bars */}
                  <div className="card p-5 space-y-5">
                    <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-brand-400" />
                      Fabrication Progress
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs text-surface-400 flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-orange-400" /> Weld Completion
                          </span>
                          <span className="text-xs font-semibold text-surface-300">{metrics.weldPct}%</span>
                        </div>
                        <ProgressBar pct={metrics.weldPct} color="bg-orange-500" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs text-surface-400 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-blue-400" /> Spool Completion
                          </span>
                          <span className="text-xs font-semibold text-surface-300">{metrics.spoolPct}%</span>
                        </div>
                        <ProgressBar pct={metrics.spoolPct} color="bg-blue-500" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs text-surface-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> NDE Pass Rate
                          </span>
                          <span className="text-xs font-semibold text-surface-300">{metrics.ndePassRate}%</span>
                        </div>
                        <ProgressBar pct={metrics.ndePassRate} color="bg-green-500" />
                      </div>
                    </div>
                  </div>

                  {/* Open items summary */}
                  {(metrics.punch.open > 0 || metrics.rfis.open > 0) && (
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        Open Items Requiring Attention
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {metrics.punch.open > 0 && (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700">
                            <ListChecks className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-surface-200">{metrics.punch.open} Punch Item{metrics.punch.open !== 1 ? 's' : ''}</p>
                              {metrics.punch.catA > 0 && (
                                <p className="text-xs text-red-400 mt-0.5">{metrics.punch.catA} Category A (must fix)</p>
                              )}
                            </div>
                          </div>
                        )}
                        {metrics.rfis.open > 0 && (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700">
                            <MessageSquare className="w-8 h-8 text-blue-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-surface-200">{metrics.rfis.open} Open RFI{metrics.rfis.open !== 1 ? 's' : ''}</p>
                              <p className="text-xs text-surface-500 mt-0.5">Awaiting response</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Recent weld activity */}
              {recentWelds.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-400" />
                    <h3 className="text-sm font-semibold text-surface-200">Recent Weld Activity</h3>
                  </div>
                  <div className="divide-y divide-surface-800">
                    {recentWelds.map((w: any) => (
                      <div key={w.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-800/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <Flame className="w-4 h-4 text-surface-600 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-surface-200">{w.weld_id_number}</span>
                            {w.welder_name && (
                              <span className="text-xs text-surface-500 ml-2">by {w.welder_name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {w.weld_date && (
                            <span className="text-xs text-surface-600">
                              {new Date(w.weld_date).toLocaleDateString()}
                            </span>
                          )}
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            weldStatusColor[w.status] ?? 'bg-surface-700 text-surface-400'
                          )}>
                            {w.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Share Links */}
      <ShareLinksPanel projects={projects} />
    </div>
  )
}
