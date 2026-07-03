'use client'
// ============================================================
// Line List — P&ID Piping Line Tracker
// ============================================================
import { useState, useMemo } from 'react'
import { List, Plus, X } from 'lucide-react'
import { useLines, useCreateLine, useUpdateLine } from '@/hooks/useLineList'
import { useProjects } from '@/hooks/useProjects'
import {
  LINE_STATUS_LABELS,
  LINE_STATUS_COLORS,
  LINE_PRIORITY_COLORS,
  type LineStatus,
  type LinePriority,
  type PipeLine,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'
import { isAfter, startOfDay } from 'date-fns'

const TODAY = startOfDay(new Date())

function isOverdue(line: PipeLine): boolean {
  if (!line.target_date) return false
  if (line.status === 'complete') return false
  return isAfter(TODAY, startOfDay(new Date(line.target_date)))
}

const EMPTY_FORM = {
  project_id:      '',
  line_number:     '',
  service:         '',
  nominal_size:    '',
  pipe_class:      '',
  fluid_code:      '',
  from_equipment:  '',
  to_equipment:    '',
  design_pressure: '',
  design_temp:     '',
  test_pressure:   '',
  insulation:      '',
  total_welds:     '0',
  total_spools:    '0',
  priority:        'normal' as LinePriority,
  status:          'not_started' as LineStatus,
  target_date:     '',
  notes:           '',
}

export default function LineListPage() {
  const { data: lines = [], isLoading } = useLines()
  const { data: projects = [] } = useProjects()
  const createLine = useCreateLine()
  const updateLine = useUpdateLine()

  const [filterProject, setFilterProject] = useState('')
  const [filterStatus,  setFilterStatus]  = useState<LineStatus | ''>('')
  const [filterPriority,setFilterPriority]= useState<LinePriority | ''>('')
  const [showModal,     setShowModal]     = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function num(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  const complete = lines.filter(l => l.status === 'complete').length
  const completePct = lines.length > 0 ? Math.round((complete / lines.length) * 100) : 0

  const filtered = useMemo(() => {
    return lines.filter(l => {
      if (filterProject  && l.project_id !== filterProject) return false
      if (filterStatus   && l.status !== filterStatus)      return false
      if (filterPriority && l.priority !== filterPriority)  return false
      return true
    })
  }, [lines, filterProject, filterStatus, filterPriority])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.project_id)  return setFormError('Project is required.')
    if (!form.line_number) return setFormError('Line number is required.')
    try {
      await createLine.mutateAsync({
        project_id:      form.project_id,
        line_number:     form.line_number,
        service:         form.service || null,
        nominal_size:    form.nominal_size || null,
        pipe_class:      form.pipe_class || null,
        fluid_code:      form.fluid_code || null,
        from_equipment:  form.from_equipment || null,
        to_equipment:    form.to_equipment || null,
        design_pressure: num(form.design_pressure),
        design_temp:     num(form.design_temp),
        test_pressure:   num(form.test_pressure),
        insulation:      form.insulation || null,
        total_welds:     parseInt(form.total_welds) || 0,
        total_spools:    parseInt(form.total_spools) || 0,
        priority:        form.priority,
        status:          form.status,
        target_date:     form.target_date || null,
        notes:           form.notes || null,
      })
      setShowModal(false)
      setForm({ ...EMPTY_FORM })
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create line.')
    }
  }

  async function handleStatusChange(id: string, status: LineStatus) {
    await updateLine.mutateAsync({ id, status })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Line List</h1>
          <p className="text-sm text-surface-500 mt-0.5">P&amp;ID piping line tracker</p>
        </div>
        <button className="btn-primary flex items-center gap-2 flex-shrink-0" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Add Line
        </button>
      </div>

      {/* Progress Bar */}
      {lines.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-surface-300">
              {complete} of {lines.length} lines complete
            </p>
            <p className="text-sm font-bold text-green-400">{completePct}%</p>
          </div>
          <div className="h-2.5 rounded-full bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${completePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input max-w-[200px]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value as LineStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(LINE_STATUS_LABELS) as LineStatus[]).map(s => (
            <option key={s} value={s}>{LINE_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className="input max-w-[140px]" value={filterPriority} onChange={e => setFilterPriority(e.target.value as LinePriority | '')}>
          <option value="">All Priorities</option>
          {(['low','normal','high','critical'] as LinePriority[]).map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <List className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">
            No lines yet. Add your first piping line to track fabrication progress.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Line #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Class</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Priority</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Welds</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Spools</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Target Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filtered.map(line => {
                  const overdue = isOverdue(line)
                  return (
                    <tr key={line.id} className="hover:bg-surface-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-surface-100">{line.line_number}</span>
                      </td>
                      <td className="px-4 py-3 text-surface-300 max-w-[160px] truncate">{line.service ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400">{line.nominal_size ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400">{line.pipe_class ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs px-2 py-0.5 rounded', LINE_STATUS_COLORS[line.status])}>
                          {LINE_STATUS_LABELS[line.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs px-2 py-0.5 rounded', LINE_PRIORITY_COLORS[line.priority])}>
                          {line.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-surface-400">{line.total_welds}</td>
                      <td className="px-4 py-3 text-right text-surface-400">{line.total_spools}</td>
                      <td className="px-4 py-3">
                        {line.target_date ? (
                          <span className={cn('text-xs', overdue ? 'text-red-400 font-medium' : 'text-surface-500')}>
                            {formatDate(line.target_date)}
                            {overdue && ' — OVERDUE'}
                          </span>
                        ) : (
                          <span className="text-surface-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input text-xs py-1 px-2 max-w-[140px]"
                          value={line.status}
                          onChange={e => handleStatusChange(line.id, e.target.value as LineStatus)}
                        >
                          {(Object.keys(LINE_STATUS_LABELS) as LineStatus[]).map(s => (
                            <option key={s} value={s}>{LINE_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Line Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-surface-50">Add Line</h2>
              <button className="btn-ghost p-1.5" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Project *</label>
                  <select className="input w-full" value={form.project_id} onChange={e => set('project_id', e.target.value)} required>
                    <option value="">Select a project…</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Line Number *</label>
                  <input className="input w-full font-mono" placeholder='3"-CS-1001-A1A' value={form.line_number} onChange={e => set('line_number', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Service</label>
                  <input className="input w-full" placeholder="Cooling Water Supply" value={form.service} onChange={e => set('service', e.target.value)} />
                </div>
                <div>
                  <label className="label">Nominal Size</label>
                  <input className="input w-full" placeholder="3 inch" value={form.nominal_size} onChange={e => set('nominal_size', e.target.value)} />
                </div>
                <div>
                  <label className="label">Pipe Class</label>
                  <input className="input w-full" placeholder="A1A" value={form.pipe_class} onChange={e => set('pipe_class', e.target.value)} />
                </div>
                <div>
                  <label className="label">Fluid Code</label>
                  <input className="input w-full" placeholder="CWS" value={form.fluid_code} onChange={e => set('fluid_code', e.target.value)} />
                </div>
                <div>
                  <label className="label">From Equipment</label>
                  <input className="input w-full" placeholder="P-101A" value={form.from_equipment} onChange={e => set('from_equipment', e.target.value)} />
                </div>
                <div>
                  <label className="label">To Equipment</label>
                  <input className="input w-full" placeholder="HX-201" value={form.to_equipment} onChange={e => set('to_equipment', e.target.value)} />
                </div>
                <div>
                  <label className="label">Design Pressure (bar/psi)</label>
                  <input type="number" className="input w-full" value={form.design_pressure} onChange={e => set('design_pressure', e.target.value)} />
                </div>
                <div>
                  <label className="label">Design Temp (°C/°F)</label>
                  <input type="number" className="input w-full" value={form.design_temp} onChange={e => set('design_temp', e.target.value)} />
                </div>
                <div>
                  <label className="label">Test Pressure</label>
                  <input type="number" className="input w-full" value={form.test_pressure} onChange={e => set('test_pressure', e.target.value)} />
                </div>
                <div>
                  <label className="label">Total Welds (expected)</label>
                  <input type="number" className="input w-full" value={form.total_welds} onChange={e => set('total_welds', e.target.value)} />
                </div>
                <div>
                  <label className="label">Total Spools (expected)</label>
                  <input type="number" className="input w-full" value={form.total_spools} onChange={e => set('total_spools', e.target.value)} />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input w-full" value={form.priority} onChange={e => set('priority', e.target.value)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="label">Target Date</label>
                  <input type="date" className="input w-full" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input w-full" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>
              </div>

              {formError && <p className="field-error">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={createLine.isPending}>
                  {createLine.isPending ? 'Saving…' : 'Add Line'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
