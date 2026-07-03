'use client'
// ============================================================
// Flange Bolt-Up — Torque Records & Inspection Status
// ============================================================
import { useState, useMemo } from 'react'
import { CircleDot, Plus, X } from 'lucide-react'
import { useFlangeJoints, useCreateFlangeJoint, useUpdateFlangeJoint } from '@/hooks/useFlanges'
import { useProjects } from '@/hooks/useProjects'
import {
  FLANGE_STATUS_LABELS,
  FLANGE_STATUS_COLORS,
  type FlangeStatus,
  type FlangeJoint,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

const FLANGE_TYPE_LABELS: Record<string, string> = {
  weld_neck:    'Weld Neck',
  slip_on:      'Slip-On',
  blind:        'Blind',
  socket_weld:  'Socket Weld',
  lap_joint:    'Lap Joint',
  threaded:     'Threaded',
  orifice:      'Orifice',
}

const EMPTY_FORM = {
  project_id:       '',
  joint_number:     '',
  line_number:      '',
  nominal_size:     '',
  flange_type:      'weld_neck',
  flange_rating:    '',
  gasket_type:      '',
  gasket_material:  '',
  bolt_spec:        '',
  bolt_size:        '',
  bolt_count:       '',
  nut_spec:         '',
  target_torque_nm: '',
  torque_unit:      'Nm',
  torque_passes:    '3',
  assembled_by:     '',
  assembly_date:    '',
  torque_wrench_id: '',
  torque_cert_date: '',
  final_torque_nm:  '',
  inspector_name:   '',
  inspection_date:  '',
  status:           'pending' as FlangeStatus,
  rejection_reason: '',
  notes:            '',
  spool_id:         null as string | null,
}

export default function FlangePage() {
  const { data: flanges = [], isLoading } = useFlangeJoints()
  const { data: projects = [] } = useProjects()
  const createFlange = useCreateFlangeJoint()
  const updateFlange = useUpdateFlangeJoint()

  const [filterProject, setFilterProject] = useState('')
  const [filterStatus,  setFilterStatus]  = useState<FlangeStatus | ''>('')
  const [search,        setSearch]        = useState('')
  const [showModal,     setShowModal]     = useState(false)
  const [detailJoint,   setDetailJoint]   = useState<FlangeJoint | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function num(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  const total    = flanges.length
  const accepted = flanges.filter(f => f.status === 'accepted').length
  const pending  = flanges.filter(f => f.status === 'pending').length
  const rejected = flanges.filter(f => f.status === 'rejected').length

  const filtered = useMemo(() => {
    return flanges.filter(f => {
      if (filterProject && f.project_id !== filterProject) return false
      if (filterStatus  && f.status !== filterStatus)      return false
      if (search) {
        const q = search.toLowerCase()
        return (
          f.joint_number.toLowerCase().includes(q) ||
          (f.line_number ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [flanges, filterProject, filterStatus, search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.project_id)    return setFormError('Project is required.')
    if (!form.joint_number)  return setFormError('Joint number is required.')
    try {
      await createFlange.mutateAsync({
        project_id:       form.project_id,
        joint_number:     form.joint_number,
        line_number:      form.line_number || null,
        nominal_size:     form.nominal_size || null,
        flange_type:      form.flange_type,
        flange_rating:    form.flange_rating || null,
        gasket_type:      form.gasket_type || null,
        gasket_material:  form.gasket_material || null,
        bolt_spec:        form.bolt_spec || null,
        bolt_size:        form.bolt_size || null,
        bolt_count:       num(form.bolt_count) != null ? parseInt(form.bolt_count) : null,
        nut_spec:         form.nut_spec || null,
        target_torque_nm: num(form.target_torque_nm),
        torque_unit:      form.torque_unit || 'Nm',
        torque_passes:    parseInt(form.torque_passes) || 3,
        assembled_by:     form.assembled_by || null,
        assembly_date:    form.assembly_date || null,
        torque_wrench_id: form.torque_wrench_id || null,
        torque_cert_date: form.torque_cert_date || null,
        final_torque_nm:  num(form.final_torque_nm),
        inspector_name:   form.inspector_name || null,
        inspection_date:  form.inspection_date || null,
        status:           form.status,
        rejection_reason: form.rejection_reason || null,
        notes:            form.notes || null,
        spool_id:         null,
      })
      setShowModal(false)
      setForm({ ...EMPTY_FORM })
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create joint.')
    }
  }

  async function handleStatusChange(id: string, status: FlangeStatus) {
    await updateFlange.mutateAsync({ id, status })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Flange Bolt-Up</h1>
          <p className="text-sm text-surface-500 mt-0.5">Torque records and inspection status</p>
        </div>
        <button className="btn-primary flex items-center gap-2 flex-shrink-0" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Add Joint
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-surface-200 mt-1">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Accepted</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{accepted}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Pending</p>
          <p className="text-3xl font-bold text-surface-400 mt-1">{pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Rejected</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input max-w-[200px]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value as FlangeStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(FLANGE_STATUS_LABELS) as FlangeStatus[]).map(s => (
            <option key={s} value={s}>{FLANGE_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          className="input flex-1 min-w-[180px]"
          placeholder="Search joint #, line #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CircleDot className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">
            No flange joints yet. Add your first joint to track bolt-up progress.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Joint #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Line #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Rating</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Target Torque</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Assembled By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filtered.map(joint => (
                  <tr
                    key={joint.id}
                    className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                    onClick={() => setDetailJoint(joint)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-surface-100">{joint.joint_number}</span>
                    </td>
                    <td className="px-4 py-3 text-surface-400">{joint.line_number ?? '—'}</td>
                    <td className="px-4 py-3 text-surface-400">{joint.nominal_size ?? '—'}</td>
                    <td className="px-4 py-3 text-surface-400">{FLANGE_TYPE_LABELS[joint.flange_type] ?? joint.flange_type}</td>
                    <td className="px-4 py-3 text-surface-400">{joint.flange_rating ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-surface-400">
                      {joint.target_torque_nm != null ? `${joint.target_torque_nm} ${joint.torque_unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-surface-400">{joint.assembled_by ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs px-2 py-0.5 rounded', FLANGE_STATUS_COLORS[joint.status])}>
                        {FLANGE_STATUS_LABELS[joint.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        className="input text-xs py-1 px-2 max-w-[130px]"
                        value={joint.status}
                        onChange={e => handleStatusChange(joint.id, e.target.value as FlangeStatus)}
                      >
                        {(Object.keys(FLANGE_STATUS_LABELS) as FlangeStatus[]).map(s => (
                          <option key={s} value={s}>{FLANGE_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailJoint && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDetailJoint(null)}>
          <div className="card w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-surface-700">
              <div>
                <h2 className="text-lg font-bold font-mono text-surface-50">{detailJoint.joint_number}</h2>
                <p className="text-sm text-surface-400">{detailJoint.line_number ?? 'No line reference'}</p>
              </div>
              <button className="btn-ghost p-1.5" onClick={() => setDetailJoint(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className={cn('badge text-sm px-2.5 py-1 rounded', FLANGE_STATUS_COLORS[detailJoint.status])}>
                  {FLANGE_STATUS_LABELS[detailJoint.status]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Flange Type',    FLANGE_TYPE_LABELS[detailJoint.flange_type] ?? detailJoint.flange_type],
                  ['Rating',         detailJoint.flange_rating],
                  ['Nominal Size',   detailJoint.nominal_size],
                  ['Gasket Type',    detailJoint.gasket_type],
                  ['Gasket Material',detailJoint.gasket_material],
                  ['Bolt Spec',      detailJoint.bolt_spec],
                  ['Bolt Size',      detailJoint.bolt_size],
                  ['Bolt Count',     detailJoint.bolt_count?.toString()],
                  ['Nut Spec',       detailJoint.nut_spec],
                  ['Target Torque',  detailJoint.target_torque_nm != null ? `${detailJoint.target_torque_nm} ${detailJoint.torque_unit}` : null],
                  ['Final Torque',   detailJoint.final_torque_nm != null ? `${detailJoint.final_torque_nm} ${detailJoint.torque_unit}` : null],
                  ['Torque Passes',  detailJoint.torque_passes?.toString()],
                  ['Assembled By',   detailJoint.assembled_by],
                  ['Assembly Date',  detailJoint.assembly_date ? formatDate(detailJoint.assembly_date) : null],
                  ['Wrench ID',      detailJoint.torque_wrench_id],
                  ['Cert Expiry',    detailJoint.torque_cert_date ? formatDate(detailJoint.torque_cert_date) : null],
                  ['Inspector',      detailJoint.inspector_name],
                  ['Inspection Date',detailJoint.inspection_date ? formatDate(detailJoint.inspection_date) : null],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <p className="text-xs text-surface-500 uppercase tracking-wide">{label as string}</p>
                    <p className="text-surface-300 mt-0.5">{(val as string) ?? '—'}</p>
                  </div>
                ))}
              </div>
              {detailJoint.rejection_reason && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-300">{detailJoint.rejection_reason}</p>
                </div>
              )}
              {detailJoint.notes && (
                <p className="text-sm text-surface-400 whitespace-pre-wrap">{detailJoint.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Joint Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-surface-50">Add Flange Joint</h2>
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
                  <label className="label">Joint Number *</label>
                  <input className="input w-full font-mono" placeholder="FJ-001" value={form.joint_number} onChange={e => set('joint_number', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Line Number</label>
                  <input className="input w-full font-mono" value={form.line_number} onChange={e => set('line_number', e.target.value)} />
                </div>
                <div>
                  <label className="label">Nominal Size</label>
                  <input className="input w-full" placeholder="6 inch" value={form.nominal_size} onChange={e => set('nominal_size', e.target.value)} />
                </div>
                <div>
                  <label className="label">Flange Type</label>
                  <select className="input w-full" value={form.flange_type} onChange={e => set('flange_type', e.target.value)}>
                    {Object.entries(FLANGE_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Flange Rating</label>
                  <input className="input w-full" placeholder="ASME 150#" value={form.flange_rating} onChange={e => set('flange_rating', e.target.value)} />
                </div>
                <div>
                  <label className="label">Gasket Type</label>
                  <input className="input w-full" placeholder="Spiral Wound" value={form.gasket_type} onChange={e => set('gasket_type', e.target.value)} />
                </div>
                <div>
                  <label className="label">Gasket Material</label>
                  <input className="input w-full" placeholder="316SS/Graphite" value={form.gasket_material} onChange={e => set('gasket_material', e.target.value)} />
                </div>
                <div>
                  <label className="label">Bolt Spec</label>
                  <input className="input w-full" placeholder="ASTM A193 B7" value={form.bolt_spec} onChange={e => set('bolt_spec', e.target.value)} />
                </div>
                <div>
                  <label className="label">Bolt Size</label>
                  <input className="input w-full" placeholder="3/4 inch x 3 inch" value={form.bolt_size} onChange={e => set('bolt_size', e.target.value)} />
                </div>
                <div>
                  <label className="label">Bolt Count</label>
                  <input type="number" className="input w-full" value={form.bolt_count} onChange={e => set('bolt_count', e.target.value)} />
                </div>
                <div>
                  <label className="label">Nut Spec</label>
                  <input className="input w-full" placeholder="ASTM A194 2H" value={form.nut_spec} onChange={e => set('nut_spec', e.target.value)} />
                </div>
                <div>
                  <label className="label">Target Torque</label>
                  <input type="number" className="input w-full" value={form.target_torque_nm} onChange={e => set('target_torque_nm', e.target.value)} />
                </div>
                <div>
                  <label className="label">Torque Unit</label>
                  <select className="input w-full" value={form.torque_unit} onChange={e => set('torque_unit', e.target.value)}>
                    <option value="Nm">Nm</option>
                    <option value="ft-lb">ft-lb</option>
                    <option value="in-lb">in-lb</option>
                  </select>
                </div>
                <div>
                  <label className="label">Torque Passes</label>
                  <input type="number" className="input w-full" value={form.torque_passes} onChange={e => set('torque_passes', e.target.value)} />
                </div>
                <div>
                  <label className="label">Assembled By</label>
                  <input className="input w-full" value={form.assembled_by} onChange={e => set('assembled_by', e.target.value)} />
                </div>
                <div>
                  <label className="label">Assembly Date</label>
                  <input type="date" className="input w-full" value={form.assembly_date} onChange={e => set('assembly_date', e.target.value)} />
                </div>
                <div>
                  <label className="label">Torque Wrench ID</label>
                  <input className="input w-full" value={form.torque_wrench_id} onChange={e => set('torque_wrench_id', e.target.value)} />
                </div>
                <div>
                  <label className="label">Final Torque Achieved</label>
                  <input type="number" className="input w-full" value={form.final_torque_nm} onChange={e => set('final_torque_nm', e.target.value)} />
                </div>
                <div>
                  <label className="label">Inspector Name</label>
                  <input className="input w-full" value={form.inspector_name} onChange={e => set('inspector_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Inspection Date</label>
                  <input type="date" className="input w-full" value={form.inspection_date} onChange={e => set('inspection_date', e.target.value)} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input w-full" value={form.status} onChange={e => set('status', e.target.value)}>
                    {(Object.keys(FLANGE_STATUS_LABELS) as FlangeStatus[]).map(s => (
                      <option key={s} value={s}>{FLANGE_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input w-full" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>
              </div>

              {formError && <p className="field-error">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={createFlange.isPending}>
                  {createFlange.isPending ? 'Saving…' : 'Add Joint'}
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
