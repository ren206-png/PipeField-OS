'use client'
// ============================================================
// Flange Manager — Tier 2 Feature 1
// Full CRUD management of flanges linked to projects.
// ============================================================
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Disc,
  Plus,
  X,
  ChevronDown,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
interface Flange {
  id:               string
  organization_id:  string
  project_id:       string
  flange_number:    string
  flange_type:      string
  pressure_class:   string
  size_inches:      number | null
  material_spec:    string | null
  heat_number:      string | null
  bolt_torque_spec: string | null
  gasket_type:      string | null
  status:           'pending' | 'assembled' | 'torqued' | 'inspected' | 'rejected'
  inspector_id:     string | null
  inspected_at:     string | null
  notes:            string | null
  created_at:       string
  updated_at:       string
}

// ── Constants ─────────────────────────────────────────────────
const FLANGE_TYPES = [
  { value: 'weld_neck',    label: 'Weld Neck'    },
  { value: 'slip_on',      label: 'Slip On'      },
  { value: 'blind',        label: 'Blind'        },
  { value: 'socket_weld',  label: 'Socket Weld'  },
  { value: 'threaded',     label: 'Threaded'     },
  { value: 'lap_joint',    label: 'Lap Joint'    },
  { value: 'orifice',      label: 'Orifice'      },
]

const PRESSURE_CLASSES = ['150', '300', '600', '900', '1500', '2500']

const FLANGE_STATUSES: { value: Flange['status']; label: string; color: string }[] = [
  { value: 'pending',    label: 'Pending',    color: 'bg-surface-700 text-surface-400'    },
  { value: 'assembled',  label: 'Assembled',  color: 'bg-blue-500/15 text-blue-300'       },
  { value: 'torqued',    label: 'Torqued',    color: 'bg-amber-500/15 text-amber-300'     },
  { value: 'inspected',  label: 'Inspected',  color: 'bg-green-500/15 text-green-300'     },
  { value: 'rejected',   label: 'Rejected',   color: 'bg-red-500/15 text-red-300'         },
]

function statusConfig(status: string) {
  return FLANGE_STATUSES.find(s => s.value === status) ?? FLANGE_STATUSES[0]
}

function flangeTypeLabel(value: string) {
  return FLANGE_TYPES.find(t => t.value === value)?.label ?? value
}

// ── Add Flange Modal ──────────────────────────────────────────
interface AddFlangeModalProps {
  projectId: string
  onClose: () => void
  onCreated: () => void
}

function AddFlangeModal({ projectId, onClose, onCreated }: AddFlangeModalProps) {
  const [form, setForm] = useState({
    flange_number:    '',
    flange_type:      'weld_neck',
    pressure_class:   '150',
    size_inches:      '',
    material_spec:    '',
    heat_number:      '',
    bolt_torque_spec: '',
    gasket_type:      '',
    notes:            '',
  })
  const [err, setErr] = useState<string | null>(null)

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/flanges', {
        method: 'POST',
        body: JSON.stringify({
          project_id:       projectId,
          flange_number:    form.flange_number.trim(),
          flange_type:      form.flange_type,
          pressure_class:   form.pressure_class,
          size_inches:      form.size_inches ? parseFloat(form.size_inches) : null,
          material_spec:    form.material_spec.trim() || null,
          heat_number:      form.heat_number.trim() || null,
          bolt_torque_spec: form.bolt_torque_spec.trim() || null,
          gasket_type:      form.gasket_type.trim() || null,
          notes:            form.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to create flange')
      }
      return res.json() as Promise<Flange>
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: (e: Error) => setErr(e.message),
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-800">
          <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
            <Disc className="w-4 h-4 text-brand-400" />
            Add Flange
          </h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {err && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {err}
            </div>
          )}

          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Flange Number *</label>
              <input
                className="input"
                value={form.flange_number}
                onChange={e => set('flange_number', e.target.value)}
                placeholder="e.g. FL-001"
              />
            </div>
            <div>
              <label className="label mb-1.5">Type</label>
              <div className="relative">
                <select
                  className="input pr-8 appearance-none"
                  value={form.flange_type}
                  onChange={e => set('flange_type', e.target.value)}
                >
                  {FLANGE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Pressure Class</label>
              <div className="relative">
                <select
                  className="input pr-8 appearance-none"
                  value={form.pressure_class}
                  onChange={e => set('pressure_class', e.target.value)}
                >
                  {PRESSURE_CLASSES.map(c => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label mb-1.5">Size (inches)</label>
              <input
                className="input"
                type="number"
                step="0.25"
                min="0"
                value={form.size_inches}
                onChange={e => set('size_inches', e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Material Spec</label>
              <input
                className="input"
                value={form.material_spec}
                onChange={e => set('material_spec', e.target.value)}
                placeholder="e.g. ASTM A105"
              />
            </div>
            <div>
              <label className="label mb-1.5">Heat Number</label>
              <input
                className="input"
                value={form.heat_number}
                onChange={e => set('heat_number', e.target.value)}
                placeholder="Links to MTR"
              />
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Bolt Torque Spec</label>
              <input
                className="input"
                value={form.bolt_torque_spec}
                onChange={e => set('bolt_torque_spec', e.target.value)}
                placeholder="e.g. 150 ft-lbs"
              />
            </div>
            <div>
              <label className="label mb-1.5">Gasket Type</label>
              <input
                className="input"
                value={form.gasket_type}
                onChange={e => set('gasket_type', e.target.value)}
                placeholder="e.g. Spiral Wound"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label mb-1.5">Notes</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-5 border-t border-surface-800">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => create()}
            disabled={isPending || !form.flange_number.trim()}
            className="btn-primary flex-1"
          >
            {isPending ? 'Adding…' : 'Add Flange'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline Status Dropdown ────────────────────────────────────
function StatusDropdown({
  flangeId,
  currentStatus,
  onUpdated,
}: {
  flangeId: string
  currentStatus: Flange['status']
  onUpdated: () => void
}) {
  const [pending, setPending] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const cfg = statusConfig(currentStatus)

  async function handleChange(newStatus: string) {
    setPending(true)
    setUpdateError(null)
    try {
      const res = await apiFetch(`/api/flanges/${flangeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const d = await res.json()
        setUpdateError(d.error ?? 'Failed to update status')
      } else {
        onUpdated()
      }
    } catch {
      setUpdateError('Failed to update status')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <div className="relative">
        <select
          className={cn(
            'text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer appearance-none pr-6',
            cfg.color,
            'bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500/50',
          )}
          value={currentStatus}
          onChange={e => handleChange(e.target.value)}
          disabled={pending}
        >
          {FLANGE_STATUSES.map(s => (
            <option key={s.value} value={s.value} className="bg-surface-800 text-surface-200">
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-500 pointer-events-none" />
      </div>
      {updateError && (
        <p className="text-xs text-red-400 mt-1 whitespace-nowrap">{updateError}</p>
      )}
    </div>
  )
}

// ── Delete Confirmation ────────────────────────────────────────
function DeleteButton({ flangeId, flangeNumber, onDeleted }: { flangeId: string; flangeNumber: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function doDelete() {
    setPending(true)
    try {
      const res = await apiFetch(`/api/flanges/${flangeId}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted()
      }
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={doDelete}
          disabled={pending}
          className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
        >
          {pending ? '…' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 rounded bg-surface-700 text-surface-400 hover:bg-surface-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Delete ${flangeNumber}`}
      className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}

// ── Stats Row ─────────────────────────────────────────────────
function StatsRow({ flanges }: { flanges: Flange[] }) {
  const counts = useMemo(() => {
    const base = { total: flanges.length, pending: 0, assembled: 0, torqued: 0, inspected: 0, rejected: 0 }
    for (const f of flanges) {
      if (f.status in base) {
        (base as Record<string, number>)[f.status]++
      }
    }
    return base
  }, [flanges])

  const stats = [
    { label: 'Total',      value: counts.total,     color: 'text-surface-300'  },
    { label: 'Pending',    value: counts.pending,    color: 'text-surface-400'  },
    { label: 'Assembled',  value: counts.assembled,  color: 'text-blue-300'     },
    { label: 'Torqued',    value: counts.torqued,    color: 'text-amber-300'    },
    { label: 'Inspected',  value: counts.inspected,  color: 'text-green-300'    },
    { label: 'Rejected',   value: counts.rejected,   color: 'text-red-300'      },
  ]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {stats.map(s => (
        <div key={s.label} className="card p-4 text-center">
          <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function FlangePage() {
  const { data: projects = [] } = useProjectsList()
  const [projectId, setProjectId] = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const qc = useQueryClient()

  // Load flanges for selected project
  const { data: flanges = [], isLoading } = useQuery({
    queryKey: ['flanges', projectId],
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiFetch(`/api/flanges?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to load flanges')
      return res.json() as Promise<Flange[]>
    },
  })

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['flanges', projectId] })
  }

  const filtered = useMemo(
    () => statusFilter === 'all' ? flanges : flanges.filter(f => f.status === statusFilter),
    [flanges, statusFilter],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <Disc className="w-6 h-6 text-brand-400" />
            Flange Manager
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Track flange assemblies, torque specs, and inspection status
          </p>
        </div>

        {projectId && (
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Flange
          </button>
        )}
      </div>

      {/* Project Selector */}
      <div className="card p-5">
        <label className="label mb-1.5">Project</label>
        <div className="relative max-w-sm">
          <select
            className="input pr-8 appearance-none"
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setStatusFilter('all') }}
          >
            <option value="">— Select a project —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `${p.project_number} — ` : ''}{p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
        </div>
      </div>

      {/* Content — only when project selected */}
      {projectId && (
        <>
          {/* Stats */}
          {flanges.length > 0 && <StatsRow flanges={flanges} />}

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                statusFilter === 'all'
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-700 text-surface-400 hover:bg-surface-600',
              )}
            >
              All
            </button>
            {FLANGE_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                  statusFilter === s.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-700 text-surface-400 hover:bg-surface-600',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-800 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <Disc className="w-10 h-10 text-surface-600 mx-auto mb-3" />
              {flanges.length === 0 ? (
                <>
                  <p className="text-surface-400 font-medium">No flanges yet</p>
                  <p className="text-surface-600 text-sm mt-1">Add your first flange.</p>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="btn-primary mt-4 flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Add Flange
                  </button>
                </>
              ) : (
                <>
                  <p className="text-surface-400 font-medium">No flanges match this filter</p>
                  <button onClick={() => setStatusFilter('all')} className="btn-ghost mt-3 text-sm">
                    Clear filter
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-900/50 border-b border-surface-800">
                      {['Flange #', 'Type', 'Class', 'Size', 'Material', 'Heat #', 'Bolt Torque', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/60">
                    {filtered.map(flange => (
                      <tr key={flange.id} className="hover:bg-surface-800/20 transition-colors">
                        {/* Flange # */}
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-surface-200 whitespace-nowrap">
                          {flange.flange_number}
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">
                          {flangeTypeLabel(flange.flange_type)}
                        </td>
                        {/* Class */}
                        <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">
                          {flange.pressure_class}
                        </td>
                        {/* Size */}
                        <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">
                          {flange.size_inches != null ? `${flange.size_inches}"` : '—'}
                        </td>
                        {/* Material */}
                        <td className="px-4 py-3 text-xs text-surface-400 max-w-[120px] truncate">
                          {flange.material_spec ?? '—'}
                        </td>
                        {/* Heat # */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {flange.heat_number ? (
                            <Link
                              href={`/material-trace?q=${encodeURIComponent(flange.heat_number)}`}
                              className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors font-mono"
                            >
                              {flange.heat_number}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-surface-600">—</span>
                          )}
                        </td>
                        {/* Bolt Torque */}
                        <td className="px-4 py-3 text-xs text-surface-400 max-w-[120px] truncate">
                          {flange.bolt_torque_spec ?? '—'}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusDropdown
                            flangeId={flange.id}
                            currentStatus={flange.status}
                            onUpdated={invalidate}
                          />
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <DeleteButton
                            flangeId={flange.id}
                            flangeNumber={flange.flange_number}
                            onDeleted={invalidate}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty project state */}
      {!projectId && (
        <div className="card p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium">Select a project to manage flanges</p>
          <p className="text-surface-600 text-sm mt-1">Choose a project from the selector above.</p>
        </div>
      )}

      {/* Add Flange Modal */}
      {showAdd && projectId && (
        <AddFlangeModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  )
}
