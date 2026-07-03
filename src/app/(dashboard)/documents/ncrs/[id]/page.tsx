'use client'
// ============================================================
// NCR — Detail Page with Status Workflow
// ============================================================
import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { isAfter, startOfDay } from 'date-fns'
import { useNcr, useUpdateNcr } from '@/hooks/useNcr'
import {
  NCR_STATUS_LABELS,
  NCR_STATUS_COLORS,
  NCR_SEVERITY_COLORS,
  NCR_DISPOSITION_LABELS,
  type NcrStatus,
  type NcrDisposition,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

const TODAY = startOfDay(new Date())

interface Props {
  params: Promise<{ id: string }>
}

export default function NcrDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: ncr, isLoading } = useNcr(id)
  const updateNcr = useUpdateNcr()

  // Modal state
  const [showDispositionModal, setShowDispositionModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)

  // Disposition form
  const [disposition, setDisposition] = useState<NcrDisposition>('repair')
  const [dispositionNotes, setDispositionNotes] = useState('')
  const [rootCause, setRootCause] = useState('')

  // Close form
  const [verifiedBy, setVerifiedBy] = useState('')
  const [verifiedDate, setVerifiedDate] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')

  if (isLoading) return <div className="p-6 text-surface-500">Loading…</div>
  if (!ncr)     return <div className="p-6 text-surface-500">NCR not found.</div>

  const overdue = ncr.due_date && ncr.status !== 'closed' && ncr.status !== 'void'
    && isAfter(TODAY, startOfDay(new Date(ncr.due_date)))

  const canEdit = ncr.status !== 'closed' && ncr.status !== 'void'

  const STATUS_FLOW: Record<NcrStatus, { label: string; next: NcrStatus } | null> = {
    open:                 { label: 'Start Review',            next: 'under_review' },
    under_review:         null, // has modal
    disposition_pending:  { label: 'Start Rework',            next: 'in_rework' },
    in_rework:            { label: 'Submit for Verification', next: 'verification_pending' },
    verification_pending: null, // has modal
    closed:               null,
    void:                 null,
  }

  async function advanceStatus(next: NcrStatus) {
    await updateNcr.mutateAsync({ id: ncr!.id, status: next })
  }

  async function submitDisposition() {
    await updateNcr.mutateAsync({
      id: ncr!.id,
      disposition,
      disposition_notes: dispositionNotes || null,
      root_cause:        rootCause || null,
      status:            'disposition_pending',
    })
    setShowDispositionModal(false)
  }

  async function submitClose() {
    await updateNcr.mutateAsync({
      id: ncr!.id,
      verified_by:       verifiedBy || null,
      verified_date:     verifiedDate || null,
      corrective_action: correctiveAction || null,
      preventive_action: preventiveAction || null,
      status:            'closed',
      closed_at:         new Date().toISOString(),
    })
    setShowCloseModal(false)
  }

  const simpleFlow = STATUS_FLOW[ncr.status]

  const STATUS_TIMELINE: NcrStatus[] = ['open','under_review','disposition_pending','in_rework','verification_pending','closed']
  const currentIdx = STATUS_TIMELINE.indexOf(ncr.status)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/documents/ncrs" className="btn-ghost p-2 mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-xl text-surface-50">{ncr.ncr_number}</span>
            <span className={cn('badge', NCR_SEVERITY_COLORS[ncr.severity])}>
              {ncr.severity.charAt(0).toUpperCase() + ncr.severity.slice(1)}
            </span>
            <span className={cn('badge', NCR_STATUS_COLORS[ncr.status])}>
              {NCR_STATUS_LABELS[ncr.status]}
            </span>
          </div>
          <p className="text-surface-200 font-semibold text-lg">{ncr.title}</p>
          {ncr.project && (
            <p className="text-sm text-surface-400">{ncr.project.name} ({ncr.project.project_number})</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {simpleFlow && (
            <button
              onClick={() => advanceStatus(simpleFlow.next)}
              disabled={updateNcr.isPending}
              className="btn-primary"
            >
              {simpleFlow.label}
            </button>
          )}
          {ncr.status === 'under_review' && (
            <button onClick={() => setShowDispositionModal(true)} className="btn-primary">
              Set Disposition
            </button>
          )}
          {ncr.status === 'verification_pending' && (
            <button onClick={() => setShowCloseModal(true)} className="btn-primary">
              Close NCR
            </button>
          )}
          {canEdit && (
            <Link href={`/documents/ncrs/${ncr.id}/edit`} className="btn-ghost flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Non-Conformance */}
        <section className="card p-5 space-y-3 md:col-span-2">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Non-Conformance</h2>
          <p className="text-sm text-surface-200 whitespace-pre-wrap">{ncr.description}</p>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {ncr.location    && <Row label="Location">{ncr.location}</Row>}
            {ncr.drawing_ref && <Row label="Drawing Ref">{ncr.drawing_ref}</Row>}
            {ncr.spec_ref    && <Row label="Spec Ref">{ncr.spec_ref}</Row>}
          </div>
        </section>

        {/* Severity & Type */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Severity &amp; Type</h2>
          <div>
            <span className={cn('badge text-sm px-3 py-1.5', NCR_SEVERITY_COLORS[ncr.severity])}>
              {ncr.severity.charAt(0).toUpperCase() + ncr.severity.slice(1)}
            </span>
          </div>
          <Row label="Type">{ncr.ncr_type.charAt(0).toUpperCase() + ncr.ncr_type.slice(1)}</Row>
          <Row label="Discipline">{ncr.discipline.charAt(0).toUpperCase() + ncr.discipline.slice(1)}</Row>
        </section>

        {/* Raised By */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Raised By</h2>
          <Row label="Raised By">{ncr.raised_by}</Row>
          <Row label="Raised Date">{formatDate(ncr.raised_date)}</Row>
          {ncr.due_date && (
            <Row label="Due Date">
              <span className={cn(overdue && 'text-red-400 font-medium')}>
                {formatDate(ncr.due_date)}{overdue ? ' — Overdue' : ''}
              </span>
            </Row>
          )}
        </section>

        {/* Disposition */}
        {ncr.disposition && (
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Disposition</h2>
            <p className="text-sm font-medium text-surface-100">{NCR_DISPOSITION_LABELS[ncr.disposition]}</p>
            {ncr.root_cause        && <Row label="Root Cause">{ncr.root_cause}</Row>}
            {ncr.disposition_notes && <Row label="Notes">{ncr.disposition_notes}</Row>}
          </section>
        )}

        {/* Resolution */}
        {ncr.status === 'closed' && (
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Resolution</h2>
            {ncr.corrective_action && <Row label="Corrective Action">{ncr.corrective_action}</Row>}
            {ncr.preventive_action && <Row label="Preventive Action">{ncr.preventive_action}</Row>}
            {ncr.verified_by       && <Row label="Verified By">{ncr.verified_by}</Row>}
            {ncr.verified_date     && <Row label="Verified Date">{formatDate(ncr.verified_date)}</Row>}
          </section>
        )}
      </div>

      {/* Status Timeline */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Status Timeline</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_TIMELINE.map((s, i) => {
            const done    = i < currentIdx
            const current = i === currentIdx && ncr.status !== 'void'
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full flex-shrink-0',
                  done    ? 'bg-green-400' :
                  current ? 'bg-brand-400' :
                            'bg-surface-600'
                )} />
                <span className={cn(
                  'text-xs',
                  done    ? 'text-green-400' :
                  current ? 'text-brand-300 font-semibold' :
                            'text-surface-600'
                )}>{NCR_STATUS_LABELS[s]}</span>
                {i < STATUS_TIMELINE.length - 1 && (
                  <span className="text-surface-700 mx-1">→</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Disposition Modal */}
      {showDispositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-surface-50">Set Disposition</h3>
            <div>
              <label className="label">Disposition</label>
              <select className="input w-full" value={disposition} onChange={e => setDisposition(e.target.value as NcrDisposition)}>
                {(Object.keys(NCR_DISPOSITION_LABELS) as NcrDisposition[]).map(k => (
                  <option key={k} value={k}>{NCR_DISPOSITION_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Root Cause</label>
              <textarea className="input w-full" rows={3} value={rootCause} onChange={e => setRootCause(e.target.value)} />
            </div>
            <div>
              <label className="label">Disposition Notes</label>
              <textarea className="input w-full" rows={3} value={dispositionNotes} onChange={e => setDispositionNotes(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-primary" onClick={submitDisposition} disabled={updateNcr.isPending}>
                {updateNcr.isPending ? 'Saving…' : 'Set Disposition'}
              </button>
              <button className="btn-ghost" onClick={() => setShowDispositionModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-surface-50">Close NCR</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Verified By</label>
                <input className="input w-full" value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} />
              </div>
              <div>
                <label className="label">Verified Date</label>
                <input type="date" className="input w-full" value={verifiedDate} onChange={e => setVerifiedDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Corrective Action</label>
              <textarea className="input w-full" rows={3} value={correctiveAction} onChange={e => setCorrectiveAction(e.target.value)} />
            </div>
            <div>
              <label className="label">Preventive Action</label>
              <textarea className="input w-full" rows={3} value={preventiveAction} onChange={e => setPreventiveAction(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-primary" onClick={submitClose} disabled={updateNcr.isPending}>
                {updateNcr.isPending ? 'Closing…' : 'Close NCR'}
              </button>
              <button className="btn-ghost" onClick={() => setShowCloseModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-surface-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-surface-200 text-right">{children}</span>
    </div>
  )
}
