'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateItp } from '@/hooks/useItp'
import { useProjects } from '@/hooks/useProjects'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ItpStatus } from '@/types'

const DISCIPLINES = ['piping','mechanical','electrical','instrumentation','civil','structural','general']

export default function NewItpPage() {
  const router = useRouter()
  const { data: projects = [] } = useProjects()
  const createItp = useCreateItp()

  const [form, setForm] = useState({
    project_id: '',
    itp_number: `ITP-${String(Date.now()).slice(-4)}`,
    title: '',
    revision: 'A',
    discipline: 'piping',
    description: '',
    status: 'draft' as ItpStatus,
    approved_by: null as string | null,
    approved_date: null as string | null,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return
    const itp = await createItp.mutateAsync({
      project_id:    form.project_id,
      itp_number:    form.itp_number,
      title:         form.title,
      revision:      form.revision || null,
      discipline:    form.discipline,
      description:   form.description || null,
      status:        form.status,
      approved_by:   form.approved_by,
      approved_date: form.approved_date,
    })
    router.push(`/documents/itps/${itp.id}`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents/itps" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">New Inspection Test Plan</h1>
          <p className="text-surface-400 mt-0.5 text-sm">Create an ITP then add activities on the next screen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">Project <span className="text-red-400">*</span></label>
          <select
            className="input w-full"
            required
            value={form.project_id}
            onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
          >
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.project_number})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">ITP Number <span className="text-red-400">*</span></label>
            <input
              className="input w-full font-mono"
              required
              value={form.itp_number}
              onChange={e => setForm(f => ({ ...f, itp_number: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Revision</label>
            <input
              className="input w-full"
              value={form.revision}
              onChange={e => setForm(f => ({ ...f, revision: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="label">Title <span className="text-red-400">*</span></label>
          <input
            className="input w-full"
            required
            placeholder="Piping Shop Fabrication ITP"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Discipline</label>
            <select
              className="input w-full"
              value={form.discipline}
              onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))}
            >
              {DISCIPLINES.map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input w-full"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as ItpStatus }))}
            >
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="approved">Approved</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Scope and purpose of this ITP…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Link href="/documents/itps" className="btn-ghost">Cancel</Link>
          <button type="submit" disabled={createItp.isPending} className="btn-primary">
            {createItp.isPending ? 'Creating…' : 'Create ITP & Add Activities →'}
          </button>
        </div>

        {createItp.isError && (
          <p className="field-error">{(createItp.error as Error).message}</p>
        )}
      </form>
    </div>
  )
}
