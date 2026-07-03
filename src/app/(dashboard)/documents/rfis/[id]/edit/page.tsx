'use client'
// ============================================================
// RFI Edit Page — pre-populated form
// ============================================================
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useRfi, useUpdateRfi } from '@/hooks/useRfi'
import type { RfiPriority, RfiStatus } from '@/types'

const DISCIPLINES = ['piping','mechanical','electrical','instrumentation','civil','structural','general']

export default function RfiEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: rfi, isLoading } = useRfi(id)
  const { data: projects = [] } = useProjects()
  const updateRfi = useUpdateRfi()

  const [projectId,      setProjectId]      = useState('')
  const [rfiNumber,      setRfiNumber]      = useState('')
  const [title,          setTitle]          = useState('')
  const [discipline,     setDiscipline]     = useState('piping')
  const [priority,       setPriority]       = useState<RfiPriority>('normal')
  const [status,         setStatus]         = useState<RfiStatus>('draft')
  const [question,       setQuestion]       = useState('')
  const [background,     setBackground]     = useState('')
  const [drawingRefs,    setDrawingRefs]    = useState('')
  const [specRefs,       setSpecRefs]       = useState('')
  const [submittedTo,    setSubmittedTo]    = useState('')
  const [submittedDate,  setSubmittedDate]  = useState('')
  const [requiredByDate, setRequiredByDate] = useState('')
  const [answer,         setAnswer]         = useState('')
  const [answeredBy,     setAnsweredBy]     = useState('')
  const [answeredDate,   setAnsweredDate]   = useState('')
  const [impact,         setImpact]         = useState('')
  const [error, setError] = useState('')

  // Pre-populate once loaded
  useEffect(() => {
    if (!rfi) return
    setProjectId(rfi.project_id)
    setRfiNumber(rfi.rfi_number)
    setTitle(rfi.title)
    setDiscipline(rfi.discipline)
    setPriority(rfi.priority)
    setStatus(rfi.status)
    setQuestion(rfi.question)
    setBackground(rfi.background ?? '')
    setDrawingRefs(rfi.drawing_refs ?? '')
    setSpecRefs(rfi.spec_refs ?? '')
    setSubmittedTo(rfi.submitted_to ?? '')
    setSubmittedDate(rfi.submitted_date ?? '')
    setRequiredByDate(rfi.required_by_date ?? '')
    setAnswer(rfi.answer ?? '')
    setAnsweredBy(rfi.answered_by ?? '')
    setAnsweredDate(rfi.answered_date ?? '')
    setImpact(rfi.impact ?? '')
  }, [rfi])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await updateRfi.mutateAsync({
        id,
        project_id:      projectId,
        rfi_number:      rfiNumber,
        title,
        discipline,
        priority,
        status,
        question,
        background:      background || null,
        drawing_refs:    drawingRefs || null,
        spec_refs:       specRefs || null,
        submitted_to:    submittedTo || null,
        submitted_date:  submittedDate || null,
        required_by_date: requiredByDate || null,
        answer:          answer || null,
        answered_by:     answeredBy || null,
        answered_date:   answeredDate || null,
        impact:          impact || null,
      })
      router.push(`/documents/rfis/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/documents/rfis/${id}`} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Edit RFI</h1>
          <p className="text-sm text-surface-500 font-mono mt-0.5">{rfi?.rfi_number}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* RFI Info */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-surface-200">RFI Info</h2>
          <div>
            <label className="label">Project</label>
            <select className="input mt-1" value={projectId} onChange={e => setProjectId(e.target.value)}>
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
            <label className="label">Title</label>
            <input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Discipline</label>
              <select className="input mt-1" value={discipline} onChange={e => setDiscipline(e.target.value)}>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={status} onChange={e => setStatus(e.target.value as RfiStatus)}>
                {(['draft','submitted','under_review','answered','closed','void'] as RfiStatus[]).map(s => (
                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-surface-200">Question</h2>
          <div>
            <label className="label">Question</label>
            <textarea className="input mt-1" rows={4} value={question} onChange={e => setQuestion(e.target.value)} />
          </div>
          <div>
            <label className="label">Background / Context</label>
            <textarea className="input mt-1" rows={3} value={background} onChange={e => setBackground(e.target.value)} />
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
            <input className="input mt-1" value={submittedTo} onChange={e => setSubmittedTo(e.target.value)} />
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

        {/* Answer (editable for admins) */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-surface-200">Answer</h2>
          <div>
            <label className="label">Answer</label>
            <textarea className="input mt-1" rows={4} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Response from engineer / owner…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Answered By</label>
              <input className="input mt-1" value={answeredBy} onChange={e => setAnsweredBy(e.target.value)} />
            </div>
            <div>
              <label className="label">Answered Date</label>
              <input type="date" className="input mt-1" value={answeredDate} onChange={e => setAnsweredDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Impact</label>
            <textarea className="input mt-1" rows={2} value={impact} onChange={e => setImpact(e.target.value)} placeholder="Schedule / cost impact…" />
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="flex gap-3">
          <Link href={`/documents/rfis/${id}`} className="btn-ghost flex-1 text-center">Cancel</Link>
          <button type="submit" disabled={updateRfi.isPending} className="btn-primary flex-1">
            {updateRfi.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
