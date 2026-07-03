'use client'
// ============================================================
// MTR — New Material Traceability Record
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useCreateMtr } from '@/hooks/useMtr'
import { useProjects } from '@/hooks/useProjects'
import type { MtrMaterialType, MtrStatus } from '@/types'

export default function NewMtrPage() {
  const router = useRouter()
  const { data: projects = [] } = useProjects()
  const createMtr = useCreateMtr()

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    project_id:       '',
    heat_number:      '',
    mtr_number:       '',
    material_spec:    '',
    material_type:    'pipe' as MtrMaterialType,
    nominal_size:     '',
    schedule:         '',
    quantity:         '',
    unit:             'pcs',
    supplier:         '',
    manufacturer:     '',
    po_number:        '',
    received_date:    today,
    storage_location: '',
    carbon_pct:       '',
    manganese_pct:    '',
    phosphorus_pct:   '',
    sulfur_pct:       '',
    silicon_pct:      '',
    yield_strength:   '',
    tensile_strength: '',
    elongation_pct:   '',
    hardness:         '',
    strength_unit:    'MPa',
    status:           'received' as MtrStatus,
    rejection_reason: '',
    notes:            '',
  })

  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function num(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.project_id)    return setError('Project is required.')
    if (!form.heat_number)   return setError('Heat number is required.')
    if (!form.material_spec) return setError('Material spec is required.')

    try {
      const mtr = await createMtr.mutateAsync({
        project_id:       form.project_id,
        heat_number:      form.heat_number,
        mtr_number:       form.mtr_number || null,
        material_spec:    form.material_spec,
        material_type:    form.material_type,
        nominal_size:     form.nominal_size || null,
        schedule:         form.schedule || null,
        quantity:         num(form.quantity),
        unit:             form.unit || null,
        supplier:         form.supplier || null,
        manufacturer:     form.manufacturer || null,
        po_number:        form.po_number || null,
        received_date:    form.received_date || null,
        storage_location: form.storage_location || null,
        carbon_pct:       num(form.carbon_pct),
        manganese_pct:    num(form.manganese_pct),
        phosphorus_pct:   num(form.phosphorus_pct),
        sulfur_pct:       num(form.sulfur_pct),
        silicon_pct:      num(form.silicon_pct),
        yield_strength:   num(form.yield_strength),
        tensile_strength: num(form.tensile_strength),
        elongation_pct:   num(form.elongation_pct),
        hardness:         num(form.hardness),
        strength_unit:    form.strength_unit || null,
        status:           form.status,
        rejection_reason: form.rejection_reason || null,
        notes:            form.notes || null,
      })
      router.push(`/documents/mtrs/${mtr.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create MTR.')
    }
  }

  const showRejection = form.status === 'rejected' || form.status === 'quarantine'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents/mtrs" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Add MTR</h1>
          <p className="text-sm text-surface-400">Material Traceability Record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Material Identity */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Material Identity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Project *</label>
              <select className="input w-full" value={form.project_id} onChange={e => set('project_id', e.target.value)} required>
                <option value="">Select a project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Heat Number *</label>
              <input className="input w-full font-mono" placeholder="A1234B" value={form.heat_number} onChange={e => set('heat_number', e.target.value)} required />
            </div>
            <div>
              <label className="label">MTR Number</label>
              <input className="input w-full" placeholder="MTR-2024-001" value={form.mtr_number} onChange={e => set('mtr_number', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Material Spec *</label>
              <input className="input w-full" placeholder="ASTM A106 Grade B" value={form.material_spec} onChange={e => set('material_spec', e.target.value)} required />
            </div>
            <div>
              <label className="label">Material Type</label>
              <select className="input w-full" value={form.material_type} onChange={e => set('material_type', e.target.value)}>
                <option value="pipe">Pipe</option>
                <option value="fitting">Fitting</option>
                <option value="flange">Flange</option>
                <option value="valve">Valve</option>
                <option value="bolt">Bolt/Stud</option>
                <option value="gasket">Gasket</option>
                <option value="plate">Plate</option>
                <option value="bar">Bar/Rod</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Nominal Size</label>
              <input className="input w-full" placeholder="6 inch / DN150" value={form.nominal_size} onChange={e => set('nominal_size', e.target.value)} />
            </div>
            <div>
              <label className="label">Schedule / Wall</label>
              <input className="input w-full" placeholder="SCH 40 / STD" value={form.schedule} onChange={e => set('schedule', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Procurement */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Procurement</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity</label>
              <input type="number" className="input w-full" placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input w-full" value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="pcs">pcs</option>
                <option value="m">m</option>
                <option value="ft">ft</option>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
            <div>
              <label className="label">Supplier</label>
              <input className="input w-full" value={form.supplier} onChange={e => set('supplier', e.target.value)} />
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <input className="input w-full" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
            </div>
            <div>
              <label className="label">PO Number</label>
              <input className="input w-full" value={form.po_number} onChange={e => set('po_number', e.target.value)} />
            </div>
            <div>
              <label className="label">Received Date</label>
              <input type="date" className="input w-full" value={form.received_date} onChange={e => set('received_date', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Storage Location</label>
              <input className="input w-full" placeholder="e.g. Yard Bay 3, Row C" value={form.storage_location} onChange={e => set('storage_location', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Chemical Composition */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Chemical Composition <span className="text-surface-600 normal-case font-normal">(optional)</span></h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Carbon %</label>
              <input type="number" step="0.0001" className="input w-full" placeholder="0.0000" value={form.carbon_pct} onChange={e => set('carbon_pct', e.target.value)} />
            </div>
            <div>
              <label className="label">Manganese %</label>
              <input type="number" step="0.0001" className="input w-full" placeholder="0.0000" value={form.manganese_pct} onChange={e => set('manganese_pct', e.target.value)} />
            </div>
            <div>
              <label className="label">Phosphorus %</label>
              <input type="number" step="0.0001" className="input w-full" placeholder="0.0000" value={form.phosphorus_pct} onChange={e => set('phosphorus_pct', e.target.value)} />
            </div>
            <div>
              <label className="label">Sulfur %</label>
              <input type="number" step="0.0001" className="input w-full" placeholder="0.0000" value={form.sulfur_pct} onChange={e => set('sulfur_pct', e.target.value)} />
            </div>
            <div>
              <label className="label">Silicon %</label>
              <input type="number" step="0.0001" className="input w-full" placeholder="0.0000" value={form.silicon_pct} onChange={e => set('silicon_pct', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Mechanical Properties */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Mechanical Properties <span className="text-surface-600 normal-case font-normal">(optional)</span></h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Yield Strength</label>
              <input type="number" className="input w-full" placeholder="0" value={form.yield_strength} onChange={e => set('yield_strength', e.target.value)} />
            </div>
            <div>
              <label className="label">Tensile Strength</label>
              <input type="number" className="input w-full" placeholder="0" value={form.tensile_strength} onChange={e => set('tensile_strength', e.target.value)} />
            </div>
            <div>
              <label className="label">Elongation %</label>
              <input type="number" step="0.01" className="input w-full" placeholder="0.00" value={form.elongation_pct} onChange={e => set('elongation_pct', e.target.value)} />
            </div>
            <div>
              <label className="label">Hardness</label>
              <input type="number" className="input w-full" placeholder="0" value={form.hardness} onChange={e => set('hardness', e.target.value)} />
            </div>
            <div>
              <label className="label">Strength Unit</label>
              <select className="input w-full" value={form.strength_unit} onChange={e => set('strength_unit', e.target.value)}>
                <option value="MPa">MPa</option>
                <option value="psi">psi</option>
              </select>
            </div>
          </div>
        </section>

        {/* Status & Notes */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Status &amp; Notes</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Status</label>
              <select className="input w-full" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="received">Received</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="quarantine">Quarantine</option>
              </select>
            </div>
            {showRejection && (
              <div>
                <label className="label">Rejection / Quarantine Reason</label>
                <textarea className="input w-full" rows={3} value={form.rejection_reason} onChange={e => set('rejection_reason', e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <textarea className="input w-full" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </section>

        {error && <p className="field-error">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={createMtr.isPending}>
            {createMtr.isPending ? 'Saving…' : 'Save MTR'}
          </button>
          <Link href="/documents/mtrs" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
