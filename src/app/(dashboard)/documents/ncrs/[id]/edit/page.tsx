'use client'
// ============================================================
// NCR — Edit Page
// ============================================================
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useNcr, useUpdateNcr } from '@/hooks/useNcr'
import { useProjects } from '@/hooks/useProjects'
import type { NcrSeverity, NcrDisposition } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function EditNcrPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const { data: ncr, isLoading } = useNcr(id)
  const { data: projects = [] } = useProjects()
  const updateNcr = useUpdateNcr()

  const [form, setForm] = useState({
    project_id:  '',
    ncr_number:  '',
    title:       '',
    severity:    'major' as NcrSeverity,
    ncr_type:    'workmanship',
    discipline:  'piping',
    description: '',
    location:    '',
    drawing_ref: '',
    spec_ref:    '',
    raised_by:   '',
    raised_date: '',
    due_date:    '',
  })

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ncr) return
    setForm({
      project_id:  ncr.project_id,
      ncr_number:  ncr.ncr_number,
      title:       ncr.title,
      severity:    ncr.severity,
      ncr_type:    ncr.ncr_type,
      discipline:  ncr.discipline,
      description: ncr.description,
      location:    ncr.location ?? '',
      drawing_ref: ncr.drawing_ref ?? '',
      spec_ref:    ncr.spec_ref ?? '',
      raised_by:   ncr.raised_by,
      raised_date: ncr.raised_date,
      due_date:    ncr.due_date ?? '',
    })
  }, [ncr])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await updateNcr.mutateAsync({
        id,
        project_id:  form.project_id,
        ncr_number:  form.ncr_number,
        title:       form.title,
        severity:    form.severity,
        ncr_type:    form.ncr_type,
        discipline:  form.discipline,
        description: form.description,
        location:    form.location    || null,
        drawing_ref: form.drawing_ref || null,
        spec_ref:    form.spec_ref    || null,
        raised_by:   form.raised_by,
        raised_date: form.raised_date,
        due_date:    form.due_date    || null,
      })
      router.push(`/documents/ncrs/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update NCR.')
    }
  }

  const readonly = ncr?.status === 'closed' || ncr?.status === 'void'

  if (isLoading) return <div className="p-6 text-surface-500">Loading…</div>
  if (!ncr)      return <div className="p-6 text-surface-500">NCR not found.</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/documents/ncrs/${id}`} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Edit NCR — {ncr.ncr_number}</h1>
          {readonly && <p className="text-sm text-surface-400 mt-0.5">This NCR is {ncr.status} and cannot be edited.</p>}
        </div>
      </div>

      {readonly ? (
        <div className="card p-6 text-surface-400">This NCR is {ncr.status}. No edits allowed.</div>
      ) : (
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
                <input className="input w-full" value={form.title} onChange={e => set('title', e.target.value)} required />
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
            <div>
              <label className="label">Description *</label>
              <textarea className="input w-full" rows={4} value={form.description} onChange={e => set('description', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Location</label>
                <input className="input w-full" value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
              <div>
                <label className="label">Drawing Reference</label>
                <input className="input w-full" value={form.drawing_ref} onChange={e => set('drawing_ref', e.target.value)} />
              </div>
              <div>
                <label className="label">Spec Reference</label>
                <input className="input w-full" value={form.spec_ref} onChange={e => set('spec_ref', e.target.value)} />
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
            <button type="submit" className="btn-primary" disabled={updateNcr.isPending}>
              {updateNcr.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href={`/documents/ncrs/${id}`} className="btn-ghost">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  )
}
