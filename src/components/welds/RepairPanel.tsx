'use client'
import { useState } from 'react'
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import {
  useWeldRepairs,
  useCreateWeldRepair,
  useUpdateWeldRepair,
  useDeleteWeldRepair,
  type WeldRepair,
  type CreateWeldRepairInput,
} from '@/hooks/useWeldRepairs'
import { formatDate } from '@/lib/utils'

const FAILURE_MODES = [
  'Porosity',
  'Crack',
  'Undercut',
  'Incomplete Fusion',
  'Overlap',
  'Burn-Through',
  'Other',
]

const REPAIR_METHODS = [
  'Grind and Re-weld',
  'Back-Gouge and Re-weld',
  'Cut and Replace',
  'Other',
]

const INSPECTION_TYPES = ['RT', 'UT', 'MT', 'PT', 'VT']

const RESULT_OPTIONS = ['pending', 'pass', 'fail'] as const

type ReInspectionResult = 'pass' | 'fail' | 'pending'

function ResultBadge({ result }: { result: ReInspectionResult | null }) {
  if (!result) return null
  const map: Record<ReInspectionResult, string> = {
    pass:    'bg-green-500/20 text-green-400 ring-1 ring-green-500/40',
    fail:    'bg-red-500/20 text-red-400 ring-1 ring-red-500/40',
    pending: 'bg-surface-600/50 text-surface-400 ring-1 ring-surface-500/40',
  }
  const label: Record<ReInspectionResult, string> = {
    pass:    '✓ PASS',
    fail:    '✗ FAIL',
    pending: '⏳ PENDING',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[result]}`}>
      {label[result]}
    </span>
  )
}

interface RepairFormState {
  repair_number:        number
  failure_mode:         string
  repair_method:        string
  authorized_by:        string
  repair_welder_stamp:  string
  repair_welder_name:   string
  repair_date:          string
  re_inspection_type:   string
  re_inspection_result: ReInspectionResult | ''
  re_inspection_date:   string
  notes:                string
}

function emptyForm(repairNumber: number): RepairFormState {
  return {
    repair_number:        repairNumber,
    failure_mode:         '',
    repair_method:        '',
    authorized_by:        '',
    repair_welder_stamp:  '',
    repair_welder_name:   '',
    repair_date:          '',
    re_inspection_type:   '',
    re_inspection_result: '',
    re_inspection_date:   '',
    notes:                '',
  }
}

function formToInput(f: RepairFormState): CreateWeldRepairInput {
  return {
    repair_number:        f.repair_number,
    failure_mode:         f.failure_mode || null,
    repair_method:        f.repair_method || null,
    authorized_by:        f.authorized_by || null,
    repair_welder_stamp:  f.repair_welder_stamp || null,
    repair_welder_name:   f.repair_welder_name || null,
    repair_date:          f.repair_date || null,
    re_inspection_type:   f.re_inspection_type || null,
    re_inspection_result: (f.re_inspection_result as ReInspectionResult) || null,
    re_inspection_date:   f.re_inspection_date || null,
    notes:                f.notes || null,
  }
}

function repairToForm(r: WeldRepair): RepairFormState {
  return {
    repair_number:        r.repair_number,
    failure_mode:         r.failure_mode ?? '',
    repair_method:        r.repair_method ?? '',
    authorized_by:        r.authorized_by ?? '',
    repair_welder_stamp:  r.repair_welder_stamp ?? '',
    repair_welder_name:   r.repair_welder_name ?? '',
    repair_date:          r.repair_date ?? '',
    re_inspection_type:   r.re_inspection_type ?? '',
    re_inspection_result: (r.re_inspection_result as ReInspectionResult) ?? '',
    re_inspection_date:   r.re_inspection_date ?? '',
    notes:                r.notes ?? '',
  }
}

interface InlineFormProps {
  initial:    RepairFormState
  onSave:     (f: RepairFormState) => void
  onCancel:   () => void
  isPending:  boolean
  title:      string
}

function InlineForm({ initial, onSave, onCancel, isPending, title }: InlineFormProps) {
  const [form, setForm] = useState<RepairFormState>(initial)
  const set = (k: keyof RepairFormState, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="border border-orange-500/30 bg-orange-500/5 rounded-xl p-4 space-y-4">
      <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">{title}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Repair #</label>
          <input
            type="number"
            min={1}
            className="input"
            value={form.repair_number}
            onChange={e => set('repair_number', parseInt(e.target.value) || 1)}
          />
        </div>

        <div>
          <label className="label">Failure Mode</label>
          <select
            className="input"
            value={form.failure_mode}
            onChange={e => set('failure_mode', e.target.value)}
          >
            <option value="">— Select —</option>
            {FAILURE_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Repair Method</label>
          <select
            className="input"
            value={form.repair_method}
            onChange={e => set('repair_method', e.target.value)}
          >
            <option value="">— Select —</option>
            {REPAIR_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Authorized By</label>
          <input
            type="text"
            className="input"
            placeholder="QC Engineer name"
            value={form.authorized_by}
            onChange={e => set('authorized_by', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Repair Welder Stamp</label>
          <input
            type="text"
            className="input"
            placeholder="W-042"
            value={form.repair_welder_stamp}
            onChange={e => set('repair_welder_stamp', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Repair Welder Name</label>
          <input
            type="text"
            className="input"
            placeholder="Welder full name"
            value={form.repair_welder_name}
            onChange={e => set('repair_welder_name', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Repair Date</label>
          <input
            type="date"
            className="input"
            value={form.repair_date}
            onChange={e => set('repair_date', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Re-inspection Type</label>
          <select
            className="input"
            value={form.re_inspection_type}
            onChange={e => set('re_inspection_type', e.target.value)}
          >
            <option value="">— Select —</option>
            {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Re-inspection Result</label>
          <select
            className="input"
            value={form.re_inspection_result}
            onChange={e => set('re_inspection_result', e.target.value as ReInspectionResult | '')}
          >
            <option value="">— Select —</option>
            {RESULT_OPTIONS.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Re-inspection Date</label>
          <input
            type="date"
            className="input"
            value={form.re_inspection_date}
            onChange={e => set('re_inspection_date', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[72px] resize-none"
          placeholder="Procedure reference, observations…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
        <button
          onClick={() => onSave(form)}
          disabled={isPending}
          className="btn-primary text-sm"
        >
          {isPending ? 'Saving…' : 'Save Repair'}
        </button>
      </div>
    </div>
  )
}

interface RepairCardProps {
  repair:   WeldRepair
  weldId:   string
  onEdit:   (r: WeldRepair) => void
  onDelete: (id: string) => void
}

function RepairCard({ repair, onEdit, onDelete }: RepairCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-surface-700/60 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40">
            Repair #{repair.repair_number}
          </span>
          {repair.failure_mode && (
            <span className="text-sm text-surface-200">
              <span className="text-surface-500">Failure:</span> {repair.failure_mode}
            </span>
          )}
          {repair.repair_method && (
            <span className="text-sm text-surface-400">
              — <span className="text-surface-500">Method:</span> {repair.repair_method}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(repair)}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
            title="Edit repair"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(repair.id)}
            className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete repair"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-surface-400">
        {repair.authorized_by && (
          <span><span className="text-surface-500">Authorized by:</span> {repair.authorized_by}</span>
        )}
        {(repair.repair_welder_stamp || repair.repair_welder_name) && (
          <span>
            <span className="text-surface-500">Welder:</span>{' '}
            {[repair.repair_welder_stamp, repair.repair_welder_name].filter(Boolean).join(' — ')}
          </span>
        )}
        {repair.repair_date && (
          <span><span className="text-surface-500">Repair Date:</span> {formatDate(repair.repair_date)}</span>
        )}
        {(repair.re_inspection_type || repair.re_inspection_result) && (
          <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <span className="text-surface-500">Re-inspection:</span>
            {repair.re_inspection_type && <span>{repair.re_inspection_type}</span>}
            {repair.re_inspection_result && (
              <ResultBadge result={repair.re_inspection_result} />
            )}
            {repair.re_inspection_date && (
              <span className="text-surface-500">({formatDate(repair.re_inspection_date)})</span>
            )}
          </span>
        )}
      </div>

      {repair.notes && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors mt-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Notes
          </button>
          {expanded && (
            <p className="text-xs text-surface-300 mt-1 leading-relaxed pl-4 border-l border-surface-700">
              {repair.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface RepairPanelProps {
  weldId:     string
  weldStatus: string
}

export function RepairPanel({ weldId, weldStatus }: RepairPanelProps) {
  const { data: repairs = [], isLoading } = useWeldRepairs(weldId)
  const createRepair = useCreateWeldRepair(weldId)
  const updateRepair = useUpdateWeldRepair(weldId)
  const deleteRepair = useDeleteWeldRepair(weldId)

  const [showForm,    setShowForm]    = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editForm,    setEditForm]    = useState<RepairFormState | null>(null)

  const shouldShow = weldStatus === 'failed' || weldStatus === 'repaired' || repairs.length > 0

  if (!shouldShow && !isLoading) return null

  async function handleCreate(form: RepairFormState) {
    await createRepair.mutateAsync(formToInput(form))
    setShowForm(false)
  }

  async function handleUpdate(form: RepairFormState) {
    if (!editingId) return
    await updateRepair.mutateAsync({ repairId: editingId, ...formToInput(form) })
    setEditingId(null)
    setEditForm(null)
  }

  function startEdit(repair: WeldRepair) {
    setEditingId(repair.id)
    setEditForm(repairToForm(repair))
    setShowForm(false)
  }

  async function handleDelete(repairId: string) {
    if (!confirm('Delete this repair record? This cannot be undone.')) return
    await deleteRepair.mutateAsync(repairId)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Repair History
          </h2>
          {repairs.length > 0 && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-semibold">
              {repairs.length}
            </span>
          )}
        </div>
        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300"
          >
            <Plus className="w-3.5 h-3.5" /> Log Repair
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-surface-500 text-center py-4">Loading repairs…</p>
      )}

      {!isLoading && repairs.length === 0 && !showForm && (
        <p className="text-xs text-surface-500 text-center py-4">
          No repair records yet. Log a repair when this weld has been reworked.
        </p>
      )}

      {repairs.map(repair => (
        editingId === repair.id && editForm ? (
          <InlineForm
            key={repair.id}
            title={`Edit Repair #${repair.repair_number}`}
            initial={editForm}
            onSave={handleUpdate}
            onCancel={() => { setEditingId(null); setEditForm(null) }}
            isPending={updateRepair.isPending}
          />
        ) : (
          <RepairCard
            key={repair.id}
            repair={repair}
            weldId={weldId}
            onEdit={startEdit}
            onDelete={handleDelete}
          />
        )
      ))}

      {showForm && (
        <InlineForm
          title="Log New Repair"
          initial={emptyForm(repairs.length + 1)}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          isPending={createRepair.isPending}
        />
      )}
    </div>
  )
}
