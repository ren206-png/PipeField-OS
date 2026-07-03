'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit3, Calendar, User, Tag, Package, Layers, Wrench, FileText, QrCode, Camera } from 'lucide-react'
import { useWeld, useUpdateWeldStatus } from '@/hooks/useWelds'
import { WeldStatusBadge } from '@/components/welds/WeldStatusBadge'
import { WeldTimeline } from '@/components/welds/WeldTimeline'
import { WeldPhotos } from '@/components/welds/WeldPhotos'
import { QRCode } from '@/components/shared/QRCode'
import { QRCodeModal } from '@/components/shared/QRCodeModal'
import { NdePanel } from '@/components/welds/NdePanel'
import { RepairPanel } from '@/components/welds/RepairPanel'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import { WELD_STATUS_LABELS, type WeldStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import { addRecent } from '@/lib/recent'

// Valid status transitions for each status
const STATUS_TRANSITIONS: Record<WeldStatus, WeldStatus[]> = {
  draft:           ['fit_up_approved'],
  fit_up_approved: ['welded', 'draft'],
  welded:          ['visual_pass', 'failed'],
  visual_pass:     ['xray_pending', 'accepted'],
  xray_pending:    ['accepted', 'failed'],
  failed:          ['repaired'],
  repaired:        ['visual_pass', 'xray_pending'],
  accepted:        [],
}

interface PageProps {
  params: { id: string }
}

export default function WeldDetailPage({ params }: PageProps) {
  const { id }      = params
  const { profile } = useAuth()
  const { data: weld, isLoading, isError } = useWeld(id)
  const updateStatus = useUpdateWeldStatus()

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus,       setNewStatus]       = useState<WeldStatus | ''>('')
  const [statusNotes,     setStatusNotes]     = useState('')
  const [showQR,          setShowQR]          = useState(false)

  // Track recent view
  useEffect(() => {
    if (weld) {
      addRecent({ id: weld.id, label: weld.weld_id_number, href: `/welds/${weld.id}`, type: 'weld', timestamp: Date.now() })
    }
  }, [weld])

  if (isLoading) return <LoadingSpinner />

  if (isError || !weld) {
    return (
      <div className="text-center py-24">
        <p className="text-surface-400">Weld not found.</p>
        <Link href="/welds" className="btn-ghost mt-4 inline-flex">← Back to Welds</Link>
      </div>
    )
  }

  const currentStatus  = weld.status as WeldStatus
  const nextStatuses   = STATUS_TRANSITIONS[currentStatus] ?? []
  const timeline       = (weld as unknown as { audit_logs?: { id: string; action: string; previous_status?: string | null; new_status?: string | null; performed_by_name?: string; performed_at: string; notes?: string | null }[] }).audit_logs ?? []
  const projectName    = (weld as unknown as { project?: { name: string } }).project?.name ?? '—'

  async function submitStatusUpdate() {
    if (!newStatus || !profile) return
    await updateStatus.mutateAsync({
      weldId:    id,
      newStatus,
      notes:     statusNotes || undefined,
    })
    setShowStatusModal(false)
    setNewStatus('')
    setStatusNotes('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/welds"
            className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-surface-50 font-mono">
                {weld.weld_id_number}
              </h1>
              <WeldStatusBadge status={currentStatus} size="lg" />
            </div>
            <p className="text-sm text-surface-500 mt-1">{projectName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {nextStatuses.length > 0 && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="btn-primary text-sm"
            >
              Update Status
            </button>
          )}
          <button
            onClick={() => setShowQR(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <QrCode className="w-3.5 h-3.5" /> QR Code
          </button>
          <Link href={`/welds/${id}/edit`} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </Link>
        </div>
      </div>

      {/* ── Status pipeline ── */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
          Inspection Pipeline
        </h2>
        <div className="flex items-center gap-1 flex-wrap">
          {(Object.keys(WELD_STATUS_LABELS) as WeldStatus[]).map((s, i, arr) => {
            const isActive  = s === currentStatus
            const isPast    = arr.indexOf(s) < arr.indexOf(currentStatus)
            return (
              <div key={s} className="flex items-center gap-1">
                <span className={`
                  text-xs px-2.5 py-1 rounded-full font-medium transition-all
                  ${isActive  ? 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/50' : ''}
                  ${isPast    ? 'bg-surface-700/50 text-surface-500 line-through' : ''}
                  ${!isActive && !isPast ? 'bg-surface-800 text-surface-600' : ''}
                `}>
                  {WELD_STATUS_LABELS[s]}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-surface-700 text-xs">›</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Details grid ── */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-4">
          Weld Details
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {weld.welder_stamp && (
            <div className="flex items-start gap-2.5">
              <Tag className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Welder Stamp</p>
                <p className="text-sm font-bold text-brand-300 font-mono mt-0.5">{weld.welder_stamp}</p>
              </div>
            </div>
          )}
          {weld.welder_name && (
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Welder</p>
                <p className="text-sm text-surface-200 mt-0.5">{weld.welder_name}</p>
              </div>
            </div>
          )}
          {weld.weld_date && (
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Weld Date</p>
                <p className="text-sm text-surface-200 mt-0.5">{formatDate(weld.weld_date)}</p>
              </div>
            </div>
          )}
          {weld.spool_number && (
            <div className="flex items-start gap-2.5">
              <Package className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Spool</p>
                <p className="text-sm font-mono text-surface-200 mt-0.5">{weld.spool_number}</p>
              </div>
            </div>
          )}
          {(weld as unknown as { pipe_size?: string }).pipe_size && (
            <div className="flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Pipe Size</p>
                <p className="text-sm text-surface-200 mt-0.5">{(weld as unknown as { pipe_size?: string }).pipe_size}</p>
              </div>
            </div>
          )}
          {(weld as unknown as { weld_process?: string }).weld_process && (
            <div className="flex items-start gap-2.5">
              <Wrench className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Process</p>
                <p className="text-sm text-surface-200 mt-0.5">{(weld as unknown as { weld_process?: string }).weld_process}</p>
              </div>
            </div>
          )}
        </div>

        {weld.notes && (
          <div className="mt-4 pt-4 border-t border-surface-700/60">
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500 mb-1">Notes</p>
                <p className="text-sm text-surface-300">{weld.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Photos & Documentation ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-4 h-4 text-surface-500" />
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Photos &amp; Documentation
          </h2>
        </div>
        <WeldPhotos weldId={id} />
      </div>

      {/* ── QR Code ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              QR Code
            </h2>
            <p className="text-xs text-surface-600 mt-0.5">
              Scan to open this weld on any device
            </p>
          </div>
          <Link
            href={`/welds/${id}/qr`}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <QrCode className="w-3.5 h-3.5" /> Print Sticker
          </Link>
        </div>
        <div className="flex items-start gap-6">
          <div className="bg-white p-3 rounded-xl flex-shrink-0">
            <QRCode
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/welds/${id}`}
              size={120}
            />
          </div>
          <div className="space-y-1.5 pt-1 text-xs text-surface-500">
            <p>Weld: <span className="font-mono font-bold text-surface-200">{weld.weld_id_number}</span></p>
            {weld.welder_stamp && <p>Stamp: <span className="font-mono text-brand-300">{weld.welder_stamp}</span></p>}
            {weld.weld_date && <p>Date: <span className="text-surface-300">{formatDate(weld.weld_date)}</span></p>}
            <p className="text-surface-600 pt-1 leading-relaxed">
              Print this sticker and apply it to the pipe or spool tag for instant field lookup.
            </p>
          </div>
        </div>
      </div>

      {/* ── NDE / Inspections ── */}
      <NdePanel weldId={id} projectId={weld.project_id} />

      {/* ── Repair History ── */}
      <RepairPanel weldId={id} weldStatus={weld.status} />

      {/* ── Timeline ── */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-4">
          Status History
        </h2>
        <WeldTimeline entries={timeline} />
      </div>

      {/* ── QR Code Modal ── */}
      <QRCodeModal
        open={showQR}
        onClose={() => setShowQR(false)}
        url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/welds/${weld.id}`}
        label={`Weld ${weld.weld_id_number}`}
        subtitle={(weld as unknown as { joint_type?: string }).joint_type ?? ''}
      />

      {/* ── Status Update Modal ── */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-surface-50">Update Weld Status</h2>

            <div>
              <label className="label">New Status</label>
              <div className="grid grid-cols-1 gap-2">
                {nextStatuses.map(s => (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    className={`
                      text-left p-3 rounded-xl border transition-all text-sm font-medium
                      ${newStatus === s
                        ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                        : 'border-surface-600 hover:border-surface-500 text-surface-300'
                      }
                    `}
                  >
                    {WELD_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                value={statusNotes}
                onChange={e => setStatusNotes(e.target.value)}
                className="input min-h-[80px] resize-none"
                placeholder="Inspection notes, RT results, repair details…"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowStatusModal(false); setNewStatus(''); setStatusNotes('') }}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={submitStatusUpdate}
                disabled={!newStatus || updateStatus.isPending}
                className="btn-primary flex-1"
              >
                {updateStatus.isPending ? 'Updating…' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
