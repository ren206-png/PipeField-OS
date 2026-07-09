'use client'
// ============================================================
// MilestonesPanel — project milestone tracker
// Timeline-style: planned vs actual dates, status workflow
// ============================================================
import { useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle, Clock, Plus, Edit2, Trash2, Loader2, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  type Milestone,
  type MilestoneStatus,
  type CreateMilestoneInput,
} from '@/hooks/useMilestones'

const STATUS_CONFIG: Record<MilestoneStatus, { icon: React.ElementType; color: string; label: string }> = {
  complete:    { icon: CheckCircle2,  color: 'text-emerald-400', label: 'Complete'    },
  in_progress: { icon: Clock,         color: 'text-brand-400',   label: 'In Progress' },
  delayed:     { icon: AlertTriangle, color: 'text-red-400',     label: 'Delayed'     },
  pending:     { icon: Circle,        color: 'text-surface-500', label: 'Pending'     },
}

const DEFAULT_MILESTONES: CreateMilestoneInput[] = [
  { name: 'IFC Drawings Issued',         sort_order: 1 },
  { name: 'Fabrication Start',           sort_order: 2 },
  { name: 'First Spool Release',         sort_order: 3 },
  { name: 'Hydrostatic Testing Complete',sort_order: 4 },
  { name: 'Mechanical Completion',       sort_order: 5 },
  { name: 'Turnover to Operations',      sort_order: 6 },
]

interface FormState {
  name:         string
  description:  string
  planned_date: string
  actual_date:  string
  status:       MilestoneStatus
  sort_order:   string
}

const EMPTY_FORM: FormState = {
  name: '', description: '', planned_date: '', actual_date: '', status: 'pending', sort_order: '0',
}

function MilestoneForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: FormState
  onSave:   (f: FormState) => void
  onCancel: () => void
  saving:   boolean
  error:    string | null
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM)
  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="bg-surface-800/60 rounded-xl p-4 space-y-3 border border-surface-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Milestone Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. IFC Drawings Issued" />
        </div>
        <div>
          <label className="label">Planned Date</label>
          <input type="date" className="input" value={form.planned_date} onChange={e => set('planned_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Actual Date</label>
          <input type="date" className="input" value={form.actual_date} onChange={e => set('actual_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value as MilestoneStatus)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
            <option value="delayed">Delayed</option>
          </select>
        </div>
        <div>
          <label className="label">Sort Order</label>
          <input type="number" className="input" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} min="0" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes…" />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} className="btn-primary text-sm py-1.5 px-4">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-sm py-1.5 px-4">Cancel</button>
      </div>
    </div>
  )
}

function MilestoneRow({
  m,
  canEdit,
  projectId,
}: {
  m:         Milestone
  canEdit:   boolean
  projectId: string
}) {
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [saveErr,  setSaveErr]  = useState<string | null>(null)

  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)

  const cfg  = STATUS_CONFIG[m.status]
  const Icon = cfg.icon

  async function handleSave(form: FormState) {
    setSaveErr(null)
    try {
      await update.mutateAsync({
        id:           m.id,
        name:         form.name,
        description:  form.description || null,
        planned_date: form.planned_date || null,
        actual_date:  form.actual_date  || null,
        status:       form.status,
        sort_order:   parseInt(form.sort_order) || 0,
      })
      setEditing(false)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete milestone "${m.name}"?`)) return
    try { await remove.mutateAsync(m.id) } catch { /* ignore */ }
  }

  if (editing) {
    return (
      <MilestoneForm
        initial={{
          name:         m.name,
          description:  m.description ?? '',
          planned_date: m.planned_date ?? '',
          actual_date:  m.actual_date  ?? '',
          status:       m.status,
          sort_order:   String(m.sort_order),
        }}
        onSave={handleSave}
        onCancel={() => { setEditing(false); setSaveErr(null) }}
        saving={update.isPending}
        error={saveErr}
      />
    )
  }

  return (
    <div className="relative pl-6">
      {/* vertical line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-surface-700" />
      {/* status dot */}
      <div className={cn('absolute left-0 top-3 w-4 h-4 flex items-center justify-center', cfg.color)}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="card p-3 mb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-surface-100">{m.name}</span>
              <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-surface-500">
              <span>Planned: {m.planned_date ? new Date(m.planned_date).toLocaleDateString() : '—'}</span>
              <span>Actual: {m.actual_date ? new Date(m.actual_date).toLocaleDateString() : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {m.description && (
              <button onClick={() => setExpanded(p => !p)} className="p-1 text-surface-500 hover:text-surface-300">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            {canEdit && (
              <>
                <button onClick={() => setEditing(true)} aria-label="Edit milestone" className="p-1 text-surface-500 hover:text-brand-400">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleDelete} aria-label="Delete milestone" disabled={remove.isPending} className="p-1 text-surface-500 hover:text-red-400">
                  {remove.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
          </div>
        </div>
        {expanded && m.description && (
          <p className="text-xs text-surface-400 mt-2 pt-2 border-t border-surface-700">{m.description}</p>
        )}
      </div>
    </div>
  )
}

interface Props {
  projectId: string
  canEdit:   boolean
}

export function MilestonesPanel({ projectId, canEdit }: Props) {
  const { data: milestones = [], isLoading } = useMilestones(projectId)
  const createM = useCreateMilestone(projectId)

  const [showForm,    setShowForm]    = useState(false)
  const [formError,   setFormError]   = useState<string | null>(null)
  const [loadingTpl,  setLoadingTpl]  = useState(false)

  async function handleSave(form: FormState) {
    setFormError(null)
    try {
      await createM.mutateAsync({
        name:         form.name,
        description:  form.description || null,
        planned_date: form.planned_date || null,
        actual_date:  form.actual_date  || null,
        status:       form.status,
        sort_order:   parseInt(form.sort_order) || 0,
      })
      setShowForm(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create milestone')
    }
  }

  async function loadTemplate() {
    setLoadingTpl(true)
    try {
      for (const m of DEFAULT_MILESTONES) {
        await createM.mutateAsync(m)
      }
    } finally {
      setLoadingTpl(false)
    }
  }

  const completed = milestones.filter(m => m.status === 'complete').length
  const total     = milestones.length

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-400" />
          <h3 className="font-semibold text-surface-100">Milestones</h3>
          {total > 0 && (
            <span className="text-xs text-surface-500">{completed}/{total} complete</span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(p => !p)}
            className="btn-ghost text-xs py-1 px-3 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Milestone
          </button>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-4">
          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? Math.round((completed / total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-4">
          <MilestoneForm
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setFormError(null) }}
            saving={createM.isPending}
            error={formError}
          />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-surface-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading milestones…
        </div>
      ) : milestones.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-surface-400 text-sm mb-3">No milestones yet</p>
          {canEdit && (
            <button
              onClick={loadTemplate}
              disabled={loadingTpl}
              className="btn-secondary text-xs py-1.5 px-4 flex items-center gap-2 mx-auto"
            >
              {loadingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              Use standard pipeline template
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-0">
          {milestones
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(m => (
              <MilestoneRow key={m.id} m={m} canEdit={canEdit} projectId={projectId} />
            ))}
        </div>
      )}
    </div>
  )
}
