'use client'
// ============================================================
// WPS Register — Welding Procedure Specifications
// ASME B31.3 requires every weld to reference a qualified WPS.
// ============================================================
import { useState } from 'react'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Loader2, FileCheck2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWpsList, useCreateWps, useUpdateWps, useDeleteWps, type WpsRecord } from '@/hooks/useWps'

const PROCESSES = ['SMAW', 'GTAW', 'FCAW', 'SAW', 'GMAW', 'MCAW', 'Other']
const POSITIONS = ['1G', '2G', '3G', '4G', '5G', '6G', 'All']

interface WpsForm {
  wps_number:           string
  revision:             string
  process:              string
  base_metal_p_numbers: string
  filler_material:      string
  thickness_min_in:     string
  thickness_max_in:     string
  position:             string
  pwht_required:        boolean
  notes:                string
  is_active:            boolean
}

const EMPTY_FORM: WpsForm = {
  wps_number: '', revision: '0', process: 'SMAW',
  base_metal_p_numbers: '', filler_material: '',
  thickness_min_in: '', thickness_max_in: '',
  position: 'All', pwht_required: false, notes: '', is_active: true,
}

function toPayload(f: WpsForm) {
  return {
    wps_number:           f.wps_number,
    revision:             f.revision || '0',
    process:              f.process,
    base_metal_p_numbers: f.base_metal_p_numbers || null,
    filler_material:      f.filler_material      || null,
    thickness_min_in:     f.thickness_min_in ? parseFloat(f.thickness_min_in) : null,
    thickness_max_in:     f.thickness_max_in ? parseFloat(f.thickness_max_in) : null,
    position:             f.position || null,
    pwht_required:        f.pwht_required,
    notes:                f.notes || null,
    is_active:            f.is_active,
  }
}

function WpsModal({
  title,
  initial,
  onSave,
  onClose,
  saving,
  error,
}: {
  title:   string
  initial: WpsForm
  onSave:  (f: WpsForm) => void
  onClose: () => void
  saving:  boolean
  error:   string | null
}) {
  const [form, setForm] = useState<WpsForm>(initial)
  const set = (k: keyof WpsForm, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-surface-700">
          <h2 className="text-lg font-bold text-surface-50">{title}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">WPS Number *</label>
              <input className="input" value={form.wps_number} onChange={e => set('wps_number', e.target.value)} placeholder="e.g. WPS-001" />
            </div>
            <div>
              <label className="label">Revision</label>
              <input className="input" value={form.revision} onChange={e => set('revision', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Process *</label>
              <select className="input" value={form.process} onChange={e => set('process', e.target.value)}>
                {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Position</label>
              <select className="input" value={form.position} onChange={e => set('position', e.target.value)}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Base Metal P-Numbers</label>
              <input className="input" value={form.base_metal_p_numbers} onChange={e => set('base_metal_p_numbers', e.target.value)} placeholder="e.g. P1 to P1" />
            </div>
            <div className="col-span-2">
              <label className="label">Filler Material</label>
              <input className="input" value={form.filler_material} onChange={e => set('filler_material', e.target.value)} placeholder="e.g. E7018, ER70S-6" />
            </div>
            <div>
              <label className="label">Min Thickness (in)</label>
              <input type="number" step="0.001" className="input" value={form.thickness_min_in} onChange={e => set('thickness_min_in', e.target.value)} placeholder="0.000" />
            </div>
            <div>
              <label className="label">Max Thickness (in)</label>
              <input type="number" step="0.001" className="input" value={form.thickness_max_in} onChange={e => set('thickness_max_in', e.target.value)} placeholder="0.000" />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes…" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.pwht_required} onChange={e => set('pwht_required', e.target.checked)} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm text-surface-300">PWHT Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm text-surface-300">Active</span>
            </label>
          </div>
          {error && <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
        </div>
        <div className="p-6 border-t border-surface-700 flex gap-3">
          <button onClick={() => onSave(form)} disabled={saving || !form.wps_number.trim() || !form.process} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save WPS'}
          </button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function WpsRow({ wps }: { wps: WpsRecord }) {
  const [expanded,   setExpanded]   = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [editError,  setEditError]  = useState<string | null>(null)
  const [deleteErr,  setDeleteErr]  = useState<string | null>(null)

  const update = useUpdateWps()
  const remove = useDeleteWps()

  async function handleSave(form: WpsForm) {
    setEditError(null)
    try {
      await update.mutateAsync({ id: wps.id, ...toPayload(form) })
      setEditing(false)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete WPS ${wps.wps_number} Rev ${wps.revision}?`)) return
    setDeleteErr(null)
    try {
      await remove.mutateAsync(wps.id)
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const thickRange = wps.thickness_min_in != null || wps.thickness_max_in != null
    ? `${wps.thickness_min_in ?? '—'}" – ${wps.thickness_max_in ?? '—'}"`
    : '—'

  return (
    <>
      {editing && (
        <WpsModal
          title={`Edit WPS ${wps.wps_number}`}
          initial={{
            wps_number:           wps.wps_number,
            revision:             wps.revision,
            process:              wps.process,
            base_metal_p_numbers: wps.base_metal_p_numbers ?? '',
            filler_material:      wps.filler_material      ?? '',
            thickness_min_in:     wps.thickness_min_in != null ? String(wps.thickness_min_in) : '',
            thickness_max_in:     wps.thickness_max_in != null ? String(wps.thickness_max_in) : '',
            position:             wps.position      ?? 'All',
            pwht_required:        wps.pwht_required,
            notes:                wps.notes         ?? '',
            is_active:            wps.is_active,
          }}
          onSave={handleSave}
          onClose={() => { setEditing(false); setEditError(null) }}
          saving={update.isPending}
          error={editError}
        />
      )}
      <tr
        className={cn(
          'border-b border-surface-800 hover:bg-surface-800/40 transition-colors cursor-pointer',
          !wps.is_active && 'opacity-50'
        )}
        onClick={() => setExpanded(p => !p)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-sm text-surface-100">{wps.wps_number}</span>
            {!wps.is_active && <span className="badge bg-surface-700 text-surface-400 text-[10px]">Inactive</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-surface-300">{wps.revision}</td>
        <td className="px-4 py-3">
          <span className="badge bg-brand-500/15 text-brand-300 font-mono text-xs">{wps.process}</span>
        </td>
        <td className="px-4 py-3 text-sm text-surface-400">{wps.base_metal_p_numbers ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-surface-400">{wps.filler_material ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-surface-400 font-mono">{thickRange}</td>
        <td className="px-4 py-3 text-sm text-surface-400">{wps.position ?? '—'}</td>
        <td className="px-4 py-3">
          {wps.pwht_required
            ? <CheckCircle2 className="w-4 h-4 text-orange-400" />
            : <XCircle      className="w-4 h-4 text-surface-600" />}
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 text-surface-500 hover:text-brand-400 transition-colors" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} disabled={remove.isPending} className="p-1.5 text-surface-500 hover:text-red-400 transition-colors" title="Delete">
              {remove.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-surface-500" /> : <ChevronDown className="w-3.5 h-3.5 text-surface-500" />}
          </div>
          {deleteErr && <p className="text-xs text-red-400 mt-1 max-w-xs">{deleteErr}</p>}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-surface-800 bg-surface-800/20">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-surface-500 mb-0.5">Base Metal P-Numbers</p>
                <p className="text-surface-200">{wps.base_metal_p_numbers ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 mb-0.5">Filler Material</p>
                <p className="text-surface-200">{wps.filler_material ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 mb-0.5">Thickness Range</p>
                <p className="text-surface-200 font-mono">{thickRange}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 mb-0.5">PWHT Required</p>
                <p className="text-surface-200">{wps.pwht_required ? 'Yes' : 'No'}</p>
              </div>
              {wps.notes && (
                <div className="col-span-full">
                  <p className="text-xs text-surface-500 mb-0.5">Notes</p>
                  <p className="text-surface-300">{wps.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function WpsPage() {
  const { data: records = [], isLoading } = useWpsList()
  const createWps = useCreateWps()

  const [showModal, setShowModal] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  async function handleCreate(form: WpsForm) {
    setCreateErr(null)
    try {
      await createWps.mutateAsync(toPayload(form) as Parameters<typeof createWps.mutateAsync>[0])
      setShowModal(false)
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Failed to create WPS')
    }
  }

  const active   = records.filter(r => r.is_active).length
  const inactive = records.filter(r => !r.is_active).length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {showModal && (
        <WpsModal
          title="Add Welding Procedure Specification"
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onClose={() => { setShowModal(false); setCreateErr(null) }}
          saving={createWps.isPending}
          error={createErr}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">WPS Register</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Welding Procedure Specifications — ASME B31.3 compliance
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add WPS
        </button>
      </div>

      {/* Stats */}
      {records.length > 0 && (
        <div className="flex gap-4">
          <div className="card px-4 py-3 flex items-center gap-3">
            <FileCheck2 className="w-4 h-4 text-brand-400" />
            <div>
              <p className="text-xs text-surface-500">Total WPS</p>
              <p className="text-lg font-bold text-surface-50">{records.length}</p>
            </div>
          </div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-xs text-surface-500">Active</p>
              <p className="text-lg font-bold text-surface-50">{active}</p>
            </div>
          </div>
          {inactive > 0 && (
            <div className="card px-4 py-3 flex items-center gap-3">
              <XCircle className="w-4 h-4 text-surface-500" />
              <div>
                <p className="text-xs text-surface-500">Inactive</p>
                <p className="text-lg font-bold text-surface-50">{inactive}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-surface-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading WPS records…</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16">
            <FileCheck2 className="w-10 h-10 text-surface-700 mx-auto mb-3" />
            <p className="text-surface-400 font-medium">No WPS records yet</p>
            <p className="text-surface-500 text-sm mt-1 mb-4">Add your qualified welding procedure specifications</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add First WPS
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-surface-700 bg-surface-800/40">
                <tr>
                  {['WPS No.', 'Rev', 'Process', 'Base Metal', 'Filler', 'Thickness', 'Position', 'PWHT', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(wps => <WpsRow key={wps.id} wps={wps} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
        <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-surface-400">
          <span className="text-surface-300 font-medium">ASME B31.3 requirement:</span> All production welds must reference a qualified WPS.
          After adding your WPS records here, you can link them to individual welds from the weld entry form.
        </p>
      </div>
    </div>
  )
}
