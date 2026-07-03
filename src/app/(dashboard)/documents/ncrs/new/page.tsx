'use client'
// ============================================================
// NCR — New Non-Conformance Report
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useCreateNcr } from '@/hooks/useNcr'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import type { NcrSeverity } from '@/types'

export default function NewNcrPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: projects = [] } = useProjects()
  const createNcr = useCreateNcr()

  const defaultNcrNumber = `NCR-${String(Date.now()).slice(-4)}`
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    project_id:  '',
    ncr_number:  defaultNcrNumber,
    title:       '',
    severity:    'major' as NcrSeverity,
    ncr_type:    'workmanship',
    discipline:  'piping',
    description: '',
    location:    '',
    drawing_ref: '',
    spec_ref:    '',
    raised_by:   profile?.full_name ?? '',
    raised_date: today,
    due_date:    '',
    status:      'open' as const,
    weld_id:     null as null,
    root_cause:  null as null,
    disposition: null as null,
    disposition_notes: null as null,
    corrective_action: null as null,
    preventive_action: null as null,
    assigned_to: null as null,
    verified_by: null as null,
    verified_date: null as null,
  })

  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.project_id)  return setError('Project is required.')
    if (!form.title)       return setError('Title is required.')
    if (!form.description) return setError('Description is required.')
    if (!form.raised_by)   return setError('Raised by is required.')

    try {
      const ncr = await createNcr.mutateAsync({
        project_id:        form.project_id,
        ncr_number:        form.ncr_number,
        title:             form.title,
        severity:          form.severity,
        ncr_type:          form.ncr_type,
        discipline:        form.discipline,
        description:       form.description,
        location:          form.location || null,
        drawing_ref:       form.drawing_ref || null,
        spec_ref:          form.spec_ref || null,
        raised_by:         form.raised_by,
        raised_date:       form.raised_date,
        due_date:          form.due_date || null,
        status:            form.status,
        weld_id:           null,
        root_cause:        null,
        disposition:       null,
        disposition_notes: null,
        corrective_action: null,
        preventive_action: null,
        assigned_to:       null,
        verified_by:       null,
        verified_date:     null,
      })
      router.push(`/documents/ncrs/${ncr.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create NCR.')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents/ncrs" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Raise NCR</h1>
          <p className="text-sm text-surface-400">Non-Conformance Report</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* NCR Identity */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">NCR Identity</h2>
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
              <label className="label">NCR Number</label>
              <input className="input w-full" value={form.ncr_number} onChange={e => set('ncr_number', e.target.value)} />
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="input w-full" value={form.severity} onChange={e => set('severity', e.target.value)}>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Title *</label>
              <input className="input w-full" placeholder="Brief description of non-conformance" value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input w-full" value={form.ncr_type} onChange={e => set('ncr_type', e.target.value)}>
                <option value="workmanship">Workmanship</option>
                <option value="material">Material</option>
                <option value="design">Design</option>
                <option value="documentation">Documentation</option>
                <option value="procedure">Procedure</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Discipline</label>
              <select className="input w-full" value={form.discipline} onChange={e => set('discipline', e.target.value)}>
                <option value="piping">Piping</option>
                <option value="mechanical">Mechanical</option>
                <option value="electrical">Electrical</option>
                <option value="instrumentation">Instrumentation</option>
                <option value="civil">Civil</option>
                <option value="structural">Structural</option>
                <option value="welding">Welding</option>
                <option value="material">Material</option>
                <option value="documentation">Documentation</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </section>

        {/* Non-Conformance Description */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Non-Conformance Description</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Description * <span className="text-surface-500 normal-case font-normal">— What does not conform?</span></label>
              <textarea className="input w-full" rows={4} value={form.description} onChange={e => set('description', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Location</label>
                <input className="input w-full" placeholder="e.g. Unit 3, Bay 12" value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
              <div>
                <label className="label">Drawing Reference</label>
                <input className="input w-full" placeholder="e.g. DWG-CW-003" value={form.drawing_ref} onChange={e => set('drawing_ref', e.target.value)} />
              </div>
              <div>
                <label className="label">Spec Reference</label>
                <input className="input w-full" placeholder="e.g. ASME B31.3 §3.2" value={form.spec_ref} onChange={e => set('spec_ref', e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        {/* Raised By */}
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Raised By</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Raised By *</label>
              <input className="input w-full" value={form.raised_by} onChange={e => set('raised_by', e.target.value)} required />
            </div>
            <div>
              <label className="label">Raised Date</label>
              <input type="date" className="input w-full" value={form.raised_date} onChange={e => set('raised_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input w-full" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
        </section>

        {error && <p className="field-error">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={createNcr.isPending}>
            {createNcr.isPending ? 'Saving…' : 'Raise NCR'}
          </button>
          <Link href="/documents/ncrs" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
