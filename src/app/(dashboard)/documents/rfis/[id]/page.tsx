'use client'
// ============================================================
// RFI Detail Page
// ============================================================
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Check, Send } from 'lucide-react'
import { differenceInCalendarDays, isAfter, startOfDay } from 'date-fns'
import { useRfi, useUpdateRfi } from '@/hooks/useRfi'
import {
  RFI_STATUS_LABELS,
  RFI_STATUS_COLORS,
  RFI_PRIORITY_COLORS,
} from '@/types'
import { cn } from '@/lib/utils'

const TODAY = startOfDay(new Date())

export default function RfiDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { data: rfi, isLoading } = useRfi(id)
  const updateRfi = useUpdateRfi()

  const [showAnswerForm, setShowAnswerForm] = useState(false)
  const [answer,       setAnswer]       = useState('')
  const [answeredBy,   setAnsweredBy]   = useState('')
  const [answeredDate, setAnsweredDate] = useState('')
  const [impact,       setImpact]       = useState('')

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!rfi) return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <p className="text-surface-400">RFI not found.</p>
      <Link href="/documents/rfis" className="btn-ghost mt-4 inline-flex">Back to RFIs</Link>
    </div>
  )

  const isOverdue = rfi.required_by_date &&
    !['answered','closed','void'].includes(rfi.status) &&
    isAfter(TODAY, startOfDay(new Date(rfi.required_by_date)))

  const daysOpen = differenceInCalendarDays(new Date(), new Date(rfi.created_at))

  async function handleSubmit() {
    await updateRfi.mutateAsync({ id: rfi!.id, status: 'submitted' })
  }

  async function handleRecordAnswer() {
    if (!answer) return
    await updateRfi.mutateAsync({
      id: rfi!.id,
      answer,
      answered_by:   answeredBy || null,
      answered_date: answeredDate || null,
      impact:        impact || null,
      status:        'answered',
    })
    setShowAnswerForm(false)
  }

  async function handleClose() {
    await updateRfi.mutateAsync({ id: rfi!.id, status: 'closed' })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <Link href="/documents/rfis" className="btn-ghost p-2 mt-1 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-xl text-surface-200">{rfi.rfi_number}</span>
            <span className={cn('badge text-xs px-2 py-0.5 rounded', RFI_PRIORITY_COLORS[rfi.priority])}>
              {rfi.priority}
            </span>
            <span className={cn('badge text-xs px-2 py-0.5 rounded', RFI_STATUS_COLORS[rfi.status])}>
              {RFI_STATUS_LABELS[rfi.status]}
            </span>
          </div>
          <h1 className="text-xl font-bold text-surface-50 mt-1">{rfi.title}</h1>
          {rfi.project && (
            <p className="text-sm text-surface-400 mt-0.5">
              {rfi.project.project_number} — {rfi.project.name} · {rfi.discipline}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Link href={`/documents/rfis/${id}/edit`} className="btn-ghost flex items-center gap-1.5 text-sm">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Link>
        {rfi.status === 'draft' && (
          <button onClick={handleSubmit} disabled={updateRfi.isPending} className="btn-primary flex items-center gap-1.5 text-sm">
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
        )}
        {(rfi.status === 'submitted' || rfi.status === 'under_review') && !showAnswerForm && (
          <button onClick={() => setShowAnswerForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Check className="w-3.5 h-3.5" /> Record Answer
          </button>
        )}
        {rfi.status === 'answered' && (
          <button onClick={handleClose} disabled={updateRfi.isPending} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-200 transition-colors font-medium">
            Close RFI
          </button>
        )}
      </div>

      {/* Record Answer inline form */}
      {showAnswerForm && (
        <div className="card p-5 border-green-500/30 space-y-4">
          <h3 className="font-semibold text-surface-200">Record Answer</h3>
          <div>
            <label className="label">Answer <span className="text-red-400">*</span></label>
            <textarea className="input mt-1" rows={4} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="The engineer's / owner's response…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Answered By</label>
              <input className="input mt-1" value={answeredBy} onChange={e => setAnsweredBy(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="label">Answered Date</label>
              <input type="date" className="input mt-1" value={answeredDate} onChange={e => setAnsweredDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Impact (optional)</label>
            <textarea className="input mt-1" rows={2} value={impact} onChange={e => setImpact(e.target.value)} placeholder="Schedule / cost impact…" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAnswerForm(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleRecordAnswer} disabled={!answer || updateRfi.isPending} className="btn-primary flex-1">
              {updateRfi.isPending ? 'Saving…' : 'Save Answer'}
            </button>
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-surface-300 text-xs uppercase tracking-wide">Question</h2>
        <p className="text-surface-100 whitespace-pre-wrap text-base">{rfi.question}</p>
        {rfi.background && (
          <>
            <p className="text-xs text-surface-500 font-semibold uppercase tracking-wide mt-3">Background / Context</p>
            <p className="text-surface-300 whitespace-pre-wrap text-sm">{rfi.background}</p>
          </>
        )}
        <div className="flex gap-4 flex-wrap text-xs text-surface-500 pt-1">
          {rfi.drawing_refs && <span>Drawings: <span className="text-surface-300">{rfi.drawing_refs}</span></span>}
          {rfi.spec_refs    && <span>Specs: <span className="text-surface-300">{rfi.spec_refs}</span></span>}
        </div>
      </div>

      {/* Submission Details */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-surface-300 text-xs uppercase tracking-wide">Submission Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-surface-500 text-xs">Submitted To</p>
            <p className="text-surface-200">{rfi.submitted_to ?? '—'}</p>
          </div>
          <div>
            <p className="text-surface-500 text-xs">Submitted Date</p>
            <p className="text-surface-200">{rfi.submitted_date ?? '—'}</p>
          </div>
          <div>
            <p className="text-surface-500 text-xs">Required By</p>
            <p className={cn('font-medium', isOverdue ? 'text-red-400' : 'text-surface-200')}>
              {rfi.required_by_date ?? '—'}
              {isOverdue && ' — OVERDUE'}
            </p>
          </div>
          <div>
            <p className="text-surface-500 text-xs">Days Elapsed</p>
            <p className="text-surface-200">{daysOpen} days</p>
          </div>
        </div>
      </div>

      {/* Answer card */}
      {rfi.answer && (
        <div className="card p-5 border-l-4 border-green-500/60 space-y-3">
          <h2 className="font-semibold text-surface-300 text-xs uppercase tracking-wide">Answer</h2>
          <p className="text-surface-100 whitespace-pre-wrap">{rfi.answer}</p>
          <div className="flex gap-4 text-xs text-surface-500 flex-wrap">
            {rfi.answered_by   && <span>By: <span className="text-surface-300">{rfi.answered_by}</span></span>}
            {rfi.answered_date && <span>Date: <span className="text-surface-300">{rfi.answered_date}</span></span>}
          </div>
          {rfi.impact && (
            <>
              <p className="text-xs text-surface-500 font-semibold uppercase tracking-wide mt-2">Impact</p>
              <p className="text-surface-300 text-sm whitespace-pre-wrap">{rfi.impact}</p>
            </>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-surface-300 text-xs uppercase tracking-wide">Timeline</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-surface-500 flex-shrink-0" />
            <span className="text-surface-400">Created</span>
            <span className="text-surface-300 ml-auto">{new Date(rfi.created_at).toLocaleDateString()}</span>
          </div>
          {rfi.submitted_date && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-surface-400">Submitted</span>
              <span className="text-surface-300 ml-auto">{rfi.submitted_date}</span>
            </div>
          )}
          {rfi.answered_date && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-surface-400">Answered</span>
              <span className="text-surface-300 ml-auto">{rfi.answered_date}</span>
            </div>
          )}
          {rfi.status === 'closed' && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-surface-400 flex-shrink-0" />
              <span className="text-surface-400">Closed</span>
              <span className="text-surface-300 ml-auto">{new Date(rfi.updated_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
