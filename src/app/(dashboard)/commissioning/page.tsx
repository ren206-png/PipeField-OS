'use client'
// ============================================================
// Commissioning — System Turnover Packages list
// ============================================================
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { useProjectsList } from '@/hooks/useProjects'
import { useStps, useCreateStp, type SystemTurnoverPackage } from '@/hooks/useCommissioning'
import Link from 'next/link'
import {
  Plus, ChevronRight, Loader2, CheckCircle2, Clock, AlertCircle,
  Zap, Package, Wrench, Activity, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Status config ─────────────────────────────────────────────
const STP_STATUS: Record<SystemTurnoverPackage['status'], { label: string; color: string; dot: string }> = {
  not_started:         { label: 'Not Started',         color: 'bg-surface-700 text-surface-400',  dot: 'bg-surface-500'  },
  pre_comm_in_progress:{ label: 'Pre-Comm In Progress', color: 'bg-yellow-500/15 text-yellow-300', dot: 'bg-yellow-400'   },
  pre_comm_complete:   { label: 'Pre-Comm Complete',    color: 'bg-blue-500/15 text-blue-300',     dot: 'bg-blue-400'     },
  comm_in_progress:    { label: 'Comm In Progress',     color: 'bg-purple-500/15 text-purple-300', dot: 'bg-purple-400'   },
  comm_complete:       { label: 'Comm Complete',        color: 'bg-teal-500/15 text-teal-300',     dot: 'bg-teal-400'     },
  accepted:            { label: 'Accepted',             color: 'bg-green-500/15 text-green-300',   dot: 'bg-green-400'    },
}

const DISCIPLINE_LABELS: Record<string, string> = {
  mechanical: 'Mechanical', piping: 'Piping', electrical: 'Electrical',
  instrumentation: 'Instrumentation', civil: 'Civil', structural: 'Structural',
  hvac: 'HVAC', process: 'Process', all: 'All Disciplines',
}

// ── Status pipeline steps ─────────────────────────────────────
const PIPELINE_STEPS = [
  'not_started', 'pre_comm_in_progress', 'pre_comm_complete',
  'comm_in_progress', 'comm_complete', 'accepted',
] as const

function StatusPipeline({ status }: { status: SystemTurnoverPackage['status'] }) {
  const idx = PIPELINE_STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_STEPS.map((s, i) => (
        <div
          key={s}
          className={cn(
            'h-1.5 rounded-full flex-1',
            i <= idx ? 'bg-brand-500' : 'bg-surface-700'
          )}
        />
      ))}
    </div>
  )
}

// ── Create Modal ──────────────────────────────────────────────
function CreateStpModal({
  projectId,
  organizationId,
  onClose,
}: {
  projectId: string
  organizationId: string
  onClose: () => void
}) {
  const create = useCreateStp()
  const [form, setForm] = useState({
    stp_number: '', system_name: '', system_description: '',
    discipline: '', responsible_engineer: '',
    pre_comm_target_date: '', comm_target_date: '',
  })
  const [error, setError] = useState<string | null>(null)

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({
        project_id: projectId,
        stp_number: form.stp_number,
        system_name: form.system_name,
        system_description: form.system_description || undefined,
        discipline: form.discipline || undefined,
        responsible_engineer: form.responsible_engineer || undefined,
        pre_comm_target_date: form.pre_comm_target_date || undefined,
        comm_target_date: form.comm_target_date || undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create STP')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <h2 className="text-base font-semibold text-surface-100">New System Turnover Package</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">STP Number *</label>
              <input className="input" placeholder="STP-001" required value={form.stp_number} onChange={e => set('stp_number', e.target.value)} />
            </div>
            <div>
              <label className="label">Discipline</label>
              <select className="input" value={form.discipline} onChange={e => set('discipline', e.target.value)}>
                <option value="">Select…</option>
                {Object.entries(DISCIPLINE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">System Name *</label>
            <input className="input" placeholder="e.g. Cooling Water System" required value={form.system_name} onChange={e => set('system_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="System scope and boundaries…" value={form.system_description} onChange={e => set('system_description', e.target.value)} />
          </div>
          <div>
            <label className="label">Responsible Engineer</label>
            <input className="input" placeholder="Engineer name" value={form.responsible_engineer} onChange={e => set('responsible_engineer', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Pre-Comm Target</label>
              <input type="date" className="input" value={form.pre_comm_target_date} onChange={e => set('pre_comm_target_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Comm Target</label>
              <input type="date" className="input" value={form.comm_target_date} onChange={e => set('comm_target_date', e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex items-center gap-2">
              {create.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create STP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── STP Card ──────────────────────────────────────────────────
function StpCard({ stp }: { stp: SystemTurnoverPackage }) {
  const cfg = STP_STATUS[stp.status]
  const items = stp.precomm_items ?? []
  const done  = items.filter(i => i.status === 'complete' || i.status === 'na').length
  const total = items.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const certs = stp.handover_certificates ?? []

  return (
    <Link href={`/commissioning/${stp.id}`} className="card p-5 hover:border-brand-500/40 transition-all group block">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-surface-500">{stp.stp_number}</span>
            {stp.discipline && (
              <span className="text-xs text-surface-600">{DISCIPLINE_LABELS[stp.discipline] ?? stp.discipline}</span>
            )}
          </div>
          <h3 className="font-semibold text-surface-100 group-hover:text-brand-300 transition-colors truncate">
            {stp.system_name}
          </h3>
          {stp.responsible_engineer && (
            <p className="text-xs text-surface-500 mt-0.5">Engr: {stp.responsible_engineer}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color)}>{cfg.label}</span>
        </div>
      </div>

      {/* Progress pipeline */}
      <StatusPipeline status={stp.status} />

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-800">
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {total > 0 ? `${done}/${total} items (${pct}%)` : 'No checklist items'}
        </div>
        {certs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-surface-500">
            <Package className="w-3.5 h-3.5" />
            {certs.length} cert{certs.length !== 1 ? 's' : ''}
          </div>
        )}
        {stp.comm_target_date && (
          <div className="flex items-center gap-1.5 text-xs text-surface-500 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            {new Date(stp.comm_target_date).toLocaleDateString()}
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-brand-400 transition-colors ml-auto" />
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function CommissioningPage() {
  const { isOrgAdmin } = useAuth()
  const { organizationId } = useOrganization()
  const { data: projects = [] } = useProjectsList()

  const [selectedProject, setSelectedProject] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: stps = [], isLoading } = useStps(selectedProject || null)

  // Stats
  const stats = {
    total:    stps.length,
    accepted: stps.filter(s => s.status === 'accepted').length,
    inComm:   stps.filter(s => s.status === 'comm_in_progress' || s.status === 'comm_complete').length,
    notStarted: stps.filter(s => s.status === 'not_started').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Commissioning</h1>
          <p className="text-sm text-surface-500 mt-0.5">System Turnover Packages &amp; pre-commissioning checklists</p>
        </div>
        {isOrgAdmin && selectedProject && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New STP
          </button>
        )}
      </div>

      {/* Project selector */}
      <div className="card p-4">
        <label className="label mb-2">Select Project</label>
        <select
          className="input max-w-sm"
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
        >
          <option value="">Choose a project…</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.project_number ? `${p.project_number} — ` : ''}{p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProject && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total STPs',  value: stats.total,      icon: Package, color: 'text-brand-400' },
              { label: 'Accepted',    value: stats.accepted,   icon: CheckCircle2, color: 'text-green-400' },
              { label: 'In Commissioning', value: stats.inComm, icon: Zap, color: 'text-purple-400' },
              { label: 'Not Started', value: stats.notStarted, icon: Clock, color: 'text-surface-500' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={cn('w-4 h-4', s.color)} />
                  <span className="text-xs text-surface-500">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-surface-50">{s.value}</p>
              </div>
            ))}
          </div>

          {/* STP Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="card p-5 space-y-3 animate-pulse">
                  <div className="h-4 bg-surface-800 rounded w-1/3" />
                  <div className="h-5 bg-surface-800 rounded w-2/3" />
                  <div className="h-2 bg-surface-800 rounded" />
                </div>
              ))}
            </div>
          ) : stps.length === 0 ? (
            <div className="card p-12 text-center">
              <Activity className="w-12 h-12 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 font-medium">No STPs yet</p>
              <p className="text-surface-600 text-sm mt-1">
                {isOrgAdmin ? 'Create your first System Turnover Package to begin commissioning tracking.' : 'No STPs have been created for this project.'}
              </p>
              {isOrgAdmin && (
                <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> New STP
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {stps.map(stp => <StpCard key={stp.id} stp={stp} />)}
            </div>
          )}
        </>
      )}

      {!selectedProject && (
        <div className="card p-12 text-center">
          <Wrench className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium">Select a project to view commissioning packages</p>
        </div>
      )}

      {showCreate && selectedProject && organizationId && (
        <CreateStpModal
          projectId={selectedProject}
          organizationId={organizationId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
