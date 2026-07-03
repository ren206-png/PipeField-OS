'use client'
// ============================================================
// RFI New — Create a new Request for Information
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useProjects } from '@/hooks/useProjects'
import { useCreateRfi } from '@/hooks/useRfi'
import type { RfiPriority } from '@/types'

const DISCIPLINES = ['piping','mechanical','electrical','instrumentation','civil','structural','general']

export default function RfiNewPage() {
  const router = useRouter()
  const { data: projects = [] } = useProjects()
  const createRfi = useCreateRfi()

  const [projectId,       setProjectId]       = useState('')
  const [rfiNumber,       setRfiNumber]       = useState(`RFI-${String(Date.now()).slice(-4)}`)
  const [title,           setTitle]           = useState('')
  const [discipline,      setDiscipline]      = useState('piping')
  const [priority,        setPriority]        = useState<RfiPriority>('normal')
  const [question,        setQuestion]        = useState('')
  const [background,      setBackground]      = useState('')
  const [drawingRefs,     setDrawingRefs]     = useState('')
  const [specRefs,        setSpecRefs]        = useState('')
  const [submittedTo,     setSubmittedTo]     = useState('')
  const [submittedDate,   setSubmittedDate]   = useState('')
  const [requiredByDate,  setRequiredByDate]  = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!projectId || !title || !question) {
      setError('Project, Title, and Question are required.')
      return
    }
    try {
      const status = submittedTo ? 'submitted' : 'draft'
      const rfi = await createRfi.mutateAsync({
        project_id:      projectId,
        rfi_number:      rfiNumber,
        title,
        discipline,
        priority,
        question,
        background:      background || null,
        drawing_refs:    drawingRefs || null,
        spec_refs:       specRefs || null,
        submitted_to:    submittedTo || null,
        submitted_date:  submittedDate || null,
        required_by_date: requiredByDate || null,
        answer:          null,
        answered_by:     null,
        answered_date:   null,
        impact:          null,
        status,
      })
      router.push(`/documents/rfis/${rfi.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create RFI.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/documents/rfis" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">New RFI</h1>
          <p className="text-sm text-surface-500 mt-0.5">Request for Information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* RFI Info */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-surface-200">RFI Info</h2>

          <div>
            <label className="label">Project <span className="text-red-400">*</span></label>
            <select className="input mt-1" value={projectId} onChange={e => setProjectId(e.target.value)} required>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">RFI Number</label>
              <input className="input mt-1 font-mono" value={rfiNumber} onChange={e => setRfiNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input mt-1" value={priority} onChange={e => setPriority(e.target.value as RfiPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Title <span className="text-red-400">*</span></label>
            <input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Brief title for this RFI" />
          </div>

          <div>
            <label className="label">Discipline</label>
            <select className="input mt-1" value={discipline} onChange={e => setDiscipline(e.target.value)}>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Question */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-surface-200">Question</h2>

          <div>
            <label className="label">Question <span className="text-red-400">*</span></label>
            <textarea
              className="input mt-1"
              rows={4}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              required
              placeholder="The actual question to the engineer / owner…"
            />
          </div>

          <div>
            <label className="label">Background / Context</label>
            <textarea className="input mt-1" rows={3} value={background} onChange={e => setBackground(e.target.value)} placeholder="Provide any relevant background information…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Drawing References</label>
              <input className="input mt-1" value={drawingRefs} onChange={e => setDrawingRefs(e.target.value)} placeholder="DWG-001, DWG-002" />
            </div>
            <div>
              <label className="label">Spec References</label>
              <input className="input mt-1" value={specRefs} onChange={e => setSpecRefs(e.target.value)} placeholder="Spec 15000 §3.2" />
            </div>
          </div>
        </div>

        {/* Submission */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-surface-200">Submission</h2>

          <div>
            <label className="label">Submitted To</label>
            <input className="input mt-1" value={submittedTo} onChange={e => setSubmittedTo(e.target.value)} placeholder="Engineer / owner contact name" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Submitted Date</label>
              <input type="date" className="input mt-1" value={submittedDate} onChange={e => setSubmittedDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Required By Date</label>
              <input type="date" className="input mt-1" value={requiredByDate} onChange={e => setRequiredByDate(e.target.value)} />
            </div>
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="flex gap-3">
          <Link href="/documents/rfis" className="btn-ghost flex-1 text-center">Cancel</Link>
          <button type="submit" disabled={createRfi.isPending} className="btn-primary flex-1">
            {createRfi.isPending ? 'Creating…' : 'Create RFI'}
          </button>
        </div>
      </form>
    </div>
  )
}
