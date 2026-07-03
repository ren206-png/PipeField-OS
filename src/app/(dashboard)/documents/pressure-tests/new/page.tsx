'use client'
// ============================================================
// New Pressure Test Record
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useCreatePressureTest } from '@/hooks/usePressureTests'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import type { PressureTestResult } from '@/types'

export default function NewPressureTestPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: projects = [] } = useProjects()
  const createPT = useCreatePressureTest()

  const defaultTestNumber = `PT-${String(Date.now()).slice(-4)}`

  const [form, setForm] = useState({
    project_id:       '',
    test_number:      defaultTestNumber,
    system_name:      '',
    line_numbers:     '',
    test_type:        'hydrostatic' as const,
    test_medium:      'water' as const,
    design_pressure:  '',
    test_pressure:    '',
    pressure_unit:    'kPa' as const,
    hold_duration_min: '30',
    ambient_temp:     '',
    test_date:        '',
    test_start_time:  '',
    test_end_time:    '',
    initial_pressure: '',
    final_pressure:   '',
    result:           'pending' as PressureTestResult,
    failure_reason:   '',
    reinspection_date:'',
    inspector_name:   profile?.full_name ?? '',
    witness_name:     '',
    witness_company:  '',
    notes:            '',
    status:           'draft' as const,
  })

  const [error, setError] = useState<string | null>(null)
  const showFailureReason = form.result === 'fail' || form.result === 'conditional_pass'

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.project_id)    return setError('Project is required.')
    if (!form.system_name)   return setError('System name is required.')
    if (!form.test_pressure) return setError('Test pressure is required.')
    if (!form.test_date)     return setError('Test date is required.')
    if (!form.inspector_name) return setError('Inspector name is required.')

    try {
      const pt = await createPT.mutateAsync({
        project_id:       form.project_id,
        test_number:      form.test_number,
        system_name:      form.system_name,
        line_numbers:     form.line_numbers || null,
        test_type:        form.test_type,
        test_medium:      form.test_medium,
        design_pressure:  form.design_pressure ? parseFloat(form.design_pressure) : null,
        test_pressure:    parseFloat(form.test_pressure),
        pressure_unit:    form.pressure_unit,
        hold_duration_min: parseInt(form.hold_duration_min, 10),
        ambient_temp:     form.ambient_temp || null,
        test_date:        form.test_date,
        test_start_time:  form.test_start_time || null,
        test_end_time:    form.test_end_time || null,
        initial_pressure: form.initial_pressure ? parseFloat(form.initial_pressure) : null,
        final_pressure:   form.final_pressure ? parseFloat(form.final_pressure) : null,
        result:           form.result,
        failure_reason:   showFailureReason ? (form.failure_reason || null) : null,
        reinspection_date: form.result === 'fail' ? (form.reinspection_date || null) : null,
        inspector_name:   form.inspector_name,
        witness_name:     form.witness_name || null,
        witness_company:  form.witness_company || null,
        notes:            form.notes || null,
        status:           form.status,
      })
      router.push(`/documents/pressure-tests/${pt.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create record.')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents/pressure-tests" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-surface-50">New Pressure Test Record</h1>
          <p className="text-sm text-surface-400">Fill in the test details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Test Identity */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Test Identity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Project *</label>
              <select className="input w-full" value={form.project_id} onChange={e => set('project_id', e.target.value)} required>
                <option value="">Select a project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Test Number</label>
              <input className="input w-full" value={form.test_number} onChange={e => set('test_number', e.target.value)} />
            </div>
            <div>
              <label className="label">Test Type</label>
              <select className="input w-full" value={form.test_type} onChange={e => set('test_type', e.target.value)}>
                <option value="hydrostatic">Hydrostatic</option>
                <option value="pneumatic">Pneumatic</option>
                <option value="leak">Leak Test</option>
                <option value="service">Service Test</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">System Name *</label>
              <input className="input w-full" placeholder="e.g. Cooling Water System — Unit 3" value={form.system_name} onChange={e => set('system_name', e.target.value)} required />
            </div>
            <div className="col-span-2">
              <label className="label">Line Numbers (comma-separated)</label>
              <input className="input w-full" placeholder="e.g. CW-3-001, CW-3-002" value={form.line_numbers} onChange={e => set('line_numbers', e.target.value)} />
            </div>
            <div>
              <label className="label">Test Medium</label>
              <select className="input w-full" value={form.test_medium} onChange={e => set('test_medium', e.target.value)}>
                <option value="water">Water</option>
                <option value="air">Air</option>
                <option value="nitrogen">Nitrogen</option>
                <option value="process_fluid">Process Fluid</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </section>

        {/* Pressures & Duration */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Pressures &amp; Duration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Pressure Unit</label>
              <select className="input w-full" value={form.pressure_unit} onChange={e => set('pressure_unit', e.target.value)}>
                <option value="kPa">kPa</option>
                <option value="psi">psi</option>
                <option value="bar">bar</option>
                <option value="MPa">MPa</option>
              </select>
            </div>
            <div>
              <label className="label">Design Pressure ({form.pressure_unit})</label>
              <input type="number" step="0.01" className="input w-full" value={form.design_pressure} onChange={e => set('design_pressure', e.target.value)} />
            </div>
            <div>
              <label className="label">Test Pressure ({form.pressure_unit}) *</label>
              <input type="number" step="0.01" className="input w-full" value={form.test_pressure} onChange={e => set('test_pressure', e.target.value)} required />
            </div>
            <div>
              <label className="label">Hold Duration (minutes)</label>
              <input type="number" min="1" className="input w-full" value={form.hold_duration_min} onChange={e => set('hold_duration_min', e.target.value)} />
            </div>
            <div>
              <label className="label">Ambient Temperature</label>
              <input className="input w-full" placeholder="e.g. 22°C" value={form.ambient_temp} onChange={e => set('ambient_temp', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Test Execution */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Test Execution</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Test Date *</label>
              <input type="date" className="input w-full" value={form.test_date} onChange={e => set('test_date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input w-full" value={form.test_start_time} onChange={e => set('test_start_time', e.target.value)} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input w-full" value={form.test_end_time} onChange={e => set('test_end_time', e.target.value)} />
            </div>
            <div>
              <label className="label">Initial Pressure ({form.pressure_unit})</label>
              <input type="number" step="0.01" className="input w-full" placeholder="At start of hold" value={form.initial_pressure} onChange={e => set('initial_pressure', e.target.value)} />
            </div>
            <div>
              <label className="label">Final Pressure ({form.pressure_unit})</label>
              <input type="number" step="0.01" className="input w-full" placeholder="At end of hold" value={form.final_pressure} onChange={e => set('final_pressure', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Result */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Result</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Result</label>
              <select className="input w-full" value={form.result} onChange={e => set('result', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="conditional_pass">Conditional Pass</option>
              </select>
            </div>
            {showFailureReason && (
              <div className="col-span-2">
                <label className="label">Failure Reason</label>
                <textarea className="input w-full" rows={3} value={form.failure_reason} onChange={e => set('failure_reason', e.target.value)} />
              </div>
            )}
            {form.result === 'fail' && (
              <div>
                <label className="label">Reinspection Date</label>
                <input type="date" className="input w-full" value={form.reinspection_date} onChange={e => set('reinspection_date', e.target.value)} />
              </div>
            )}
          </div>
        </section>

        {/* Personnel */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Personnel</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Inspector Name *</label>
              <input className="input w-full" value={form.inspector_name} onChange={e => set('inspector_name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Witness Name</label>
              <input className="input w-full" value={form.witness_name} onChange={e => set('witness_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Witness Company</label>
              <input className="input w-full" value={form.witness_company} onChange={e => set('witness_company', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Notes</h2>
          <textarea className="input w-full" rows={4} placeholder="Additional notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </section>

        {error && <p className="field-error">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={createPT.isPending}>
            {createPT.isPending ? 'Saving…' : 'Save Test Record'}
          </button>
          <Link href="/documents/pressure-tests" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
