'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Edit3, Layers, Package, MapPin, Calendar,
  Thermometer, Gauge, Ruler, Plus, Trash2, Check, X, Flame,
  FileDown, Loader2, QrCode,
} from 'lucide-react'
import { useSpool, useUpdateSpoolStatus, useToggleSpoolItem, useAddSpoolItem, useDeleteSpoolItem } from '@/hooks/useSpools'
import { useWelds } from '@/hooks/useWelds'
import { SpoolStatusBadge } from '@/components/spools/SpoolStatusBadge'
import { WeldStatusBadge } from '@/components/welds/WeldStatusBadge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { QRCodeModal } from '@/components/shared/QRCodeModal'
import { useAuth } from '@/hooks/useAuth'
import { SPOOL_STATUS_LABELS, type SpoolStatus, type SpoolWithRelations, type WeldStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import { addRecent } from '@/lib/recent'

// Valid status transitions
const STATUS_TRANSITIONS: Record<SpoolStatus, SpoolStatus[]> = {
  designed:          ['material_released'],
  material_released: ['cut', 'designed'],
  cut:               ['fit_up', 'material_released'],
  fit_up:            ['welded', 'cut'],
  welded:            ['nde', 'fit_up'],
  nde:               ['painted', 'welded'],
  painted:           ['released', 'nde'],
  released:          [],
}

const ITEM_TYPES = ['pipe', 'elbow', 'tee', 'flange', 'reducer', 'cap', 'other']

interface PageProps { params: { id: string } }

export default function SpoolDetailPage({ params }: PageProps) {
  const { id }       = params
  const { profile }  = useAuth()
  const { data: spool, isLoading, isError } = useSpool(id)
  const updateStatus = useUpdateSpoolStatus()
  const toggleItem   = useToggleSpoolItem()
  const addItem      = useAddSpoolItem()
  const deleteItem   = useDeleteSpoolItem()

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus,       setNewStatus]       = useState<SpoolStatus | ''>('')
  const [statusNotes,     setStatusNotes]     = useState('')
  const [showAddItem,     setShowAddItem]     = useState(false)
  const [downloading,     setDownloading]     = useState(false)
  const [showQR,          setShowQR]          = useState(false)

  // Track recent view
  useEffect(() => {
    if (spool) {
      addRecent({ id: spool.id, label: spool.spool_number, href: `/spools/${spool.id}`, type: 'spool', timestamp: Date.now() })
    }
  }, [spool])

  async function downloadReleaseCert() {
    setDownloading(true)
    try {
      const res = await fetch('/api/reports/spool-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spoolId: id }),
      })
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `spool-release-${spool?.spool_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate certificate')
    } finally {
      setDownloading(false)
    }
  }

  // Add item form state
  const [newItemType,  setNewItemType]  = useState('pipe')
  const [newItemDesc,  setNewItemDesc]  = useState('')
  const [newItemQty,   setNewItemQty]   = useState('1')
  const [newItemLen,   setNewItemLen]   = useState('')
  const [newItemHeat,  setNewItemHeat]  = useState('')

  // Welds linked to this spool via spool_number
  const { data: weldsData } = useWelds({
    projectId: spool?.project_id,
  })
  const linkedWelds = weldsData?.welds?.filter(
    w => w.spool_number === spool?.spool_number
  ) ?? []

  if (isLoading) return <LoadingSpinner />
  if (isError || !spool) {
    return (
      <div className="text-center py-24">
        <p className="text-surface-400">Spool not found.</p>
        <Link href="/spools" className="btn-ghost mt-4 inline-flex">← Back to Spools</Link>
      </div>
    )
  }

  const s             = spool as SpoolWithRelations
  const currentStatus = s.status
  const nextStatuses  = STATUS_TRANSITIONS[currentStatus] ?? []
  const items         = s.spool_items ?? []

  // Progress: position in pipeline
  const PIPELINE = Object.keys(SPOOL_STATUS_LABELS) as SpoolStatus[]
  const currentIdx = PIPELINE.indexOf(currentStatus)
  const progress   = Math.round(((currentIdx + 1) / PIPELINE.length) * 100)

  async function submitStatusUpdate() {
    if (!newStatus || !profile) return
    await updateStatus.mutateAsync({ spoolId: id, newStatus, notes: statusNotes || undefined })
    setShowStatusModal(false)
    setNewStatus('')
    setStatusNotes('')
  }

  async function handleAddItem() {
    if (!newItemDesc.trim() || !profile) return
    await addItem.mutateAsync({
      spoolId:     id,
      item_number: items.length + 1,
      item_type:   newItemType,
      description: newItemDesc,
      quantity:    parseInt(newItemQty) || 1,
      length_in:   newItemLen  ? parseFloat(newItemLen) : undefined,
      heat_number: newItemHeat || undefined,
    })
    setShowAddItem(false)
    setNewItemDesc('')
    setNewItemQty('1')
    setNewItemLen('')
    setNewItemHeat('')
  }

  const cutCount    = items.filter((i: any) => i.is_cut).length
  const fittedCount = items.filter((i: any) => i.is_fitted).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/spools"
            className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-surface-50 font-mono">{s.spool_number}</h1>
              {s.revision && <span className="text-sm text-surface-500 font-mono">Rev {s.revision}</span>}
              <SpoolStatusBadge status={currentStatus} size="lg" />
            </div>
            <p className="text-sm text-surface-500 mt-1">{s.projects?.name ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {nextStatuses.length > 0 && (
            <button onClick={() => setShowStatusModal(true)} className="btn-primary text-sm">
              Advance Status
            </button>
          )}
          {currentStatus === 'released' && (
            <button
              onClick={downloadReleaseCert}
              disabled={downloading}
              className="btn-ghost flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300"
            >
              {downloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileDown className="w-3.5 h-3.5" />
              }
              {downloading ? 'Generating…' : 'Release Certificate'}
            </button>
          )}
          <button
            onClick={() => setShowQR(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <QrCode className="w-3.5 h-3.5" /> QR Code
          </button>
          <Link href={`/spools/${id}/edit`} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </Link>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Fabrication Progress
          </h2>
          <span className="text-xs font-bold text-brand-400">{progress}%</span>
        </div>
        <div className="h-2 bg-surface-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {PIPELINE.map((st, i) => (
            <div key={st} className="flex items-center gap-1">
              <span className={`
                text-xs px-2 py-0.5 rounded-full font-medium transition-all
                ${st === currentStatus ? 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/50' : ''}
                ${i < currentIdx ? 'bg-surface-700/50 text-surface-500' : ''}
                ${i > currentIdx ? 'bg-surface-800 text-surface-700' : ''}
              `}>
                {SPOOL_STATUS_LABELS[st]}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-surface-700 text-xs">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Spec details ── */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-4">Specification</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {s.pipe_size && (
            <div className="flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Pipe Size</p>
                <p className="text-sm font-bold text-brand-300 font-mono mt-0.5">{s.pipe_size}</p>
              </div>
            </div>
          )}
          {s.pipe_schedule && (
            <div className="flex items-start gap-2.5">
              <Package className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Schedule</p>
                <p className="text-sm text-surface-200 mt-0.5">{s.pipe_schedule}</p>
              </div>
            </div>
          )}
          {s.material && (
            <div className="flex items-start gap-2.5">
              <Package className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Material</p>
                <p className="text-sm text-surface-200 mt-0.5">{s.material}</p>
              </div>
            </div>
          )}
          {s.service && (
            <div className="flex items-start gap-2.5">
              <Gauge className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Service</p>
                <p className="text-sm text-surface-200 mt-0.5">{s.service}</p>
              </div>
            </div>
          )}
          {s.design_pressure && (
            <div className="flex items-start gap-2.5">
              <Gauge className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Design Pressure</p>
                <p className="text-sm text-surface-200 mt-0.5">{s.design_pressure} PSI</p>
              </div>
            </div>
          )}
          {s.design_temp && (
            <div className="flex items-start gap-2.5">
              <Thermometer className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Design Temp</p>
                <p className="text-sm text-surface-200 mt-0.5">{s.design_temp}°F</p>
              </div>
            </div>
          )}
          {s.isometric_ref && (
            <div className="flex items-start gap-2.5">
              <Ruler className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">ISO Ref</p>
                <p className="text-sm font-mono text-surface-200 mt-0.5">{s.isometric_ref}</p>
              </div>
            </div>
          )}
          {s.area && (
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Area</p>
                <p className="text-sm text-surface-200 mt-0.5">{s.area}</p>
              </div>
            </div>
          )}
          {s.required_date && (
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-surface-500">Required By</p>
                <p className="text-sm text-surface-200 mt-0.5">{formatDate(s.required_date)}</p>
              </div>
            </div>
          )}
        </div>
        {s.notes && (
          <div className="mt-4 pt-4 border-t border-surface-700/60">
            <p className="text-xs text-surface-500 mb-1">Notes</p>
            <p className="text-sm text-surface-300">{s.notes}</p>
          </div>
        )}
      </div>

      {/* ── Bill of Materials / Spool Items ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Bill of Materials
            </h2>
            {items.length > 0 && (
              <p className="text-xs text-surface-600 mt-0.5">
                {cutCount}/{items.length} cut · {fittedCount}/{items.length} fitted
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAddItem(a => !a)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        {/* Add item form */}
        {showAddItem && (
          <div className="mb-4 p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Type</label>
                <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="input">
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description *</label>
                <input
                  value={newItemDesc}
                  onChange={e => setNewItemDesc(e.target.value)}
                  className="input"
                  placeholder='e.g. 6" A106 Gr.B Pipe'
                />
              </div>
              <div>
                <label className="label">Qty</label>
                <input
                  type="number"
                  value={newItemQty}
                  onChange={e => setNewItemQty(e.target.value)}
                  className="input"
                  min="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Length (in)</label>
                <input
                  type="number"
                  step="0.001"
                  value={newItemLen}
                  onChange={e => setNewItemLen(e.target.value)}
                  className="input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label">Heat #</label>
                <input
                  value={newItemHeat}
                  onChange={e => setNewItemHeat(e.target.value)}
                  className="input font-mono"
                  placeholder="Heat number"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddItem(false)} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleAddItem}
                disabled={!newItemDesc.trim() || addItem.isPending}
                className="btn-primary text-sm"
              >
                {addItem.isPending ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          </div>
        )}

        {items.length === 0 && !showAddItem && (
          <p className="text-sm text-surface-600 text-center py-6">
            No items yet — add pipe pieces, fittings, and flanges.
          </p>
        )}

        {items.length > 0 && (
          <div className="space-y-1">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 px-2 text-xs text-surface-600 font-medium mb-2">
              <span className="col-span-1">#</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-1 text-center">Qty</span>
              <span className="col-span-2 text-center hidden sm:block">Length</span>
              <span className="col-span-1 text-center">Cut</span>
              <span className="col-span-1 text-center">Fit</span>
              <span className="col-span-2 hidden sm:block">Heat #</span>
            </div>

            {items.map((item: any) => (
              <div
                key={item.id}
                className={`
                  grid grid-cols-12 gap-2 px-2 py-2.5 rounded-lg items-center text-sm
                  ${item.is_fitted ? 'bg-green-500/5 border border-green-500/10' : 'hover:bg-surface-800'}
                  transition-colors group
                `}
              >
                <span className="col-span-1 text-xs text-surface-600 font-mono">{item.item_number}</span>
                <div className="col-span-4 min-w-0">
                  <p className="text-surface-200 truncate">{item.description}</p>
                  <p className="text-xs text-surface-600 capitalize">{item.item_type}</p>
                </div>
                <span className="col-span-1 text-center text-surface-400">{item.quantity}</span>
                <span className="col-span-2 text-center text-surface-500 hidden sm:block font-mono text-xs">
                  {item.length_in ? `${item.length_in}"` : '—'}
                </span>

                {/* Cut toggle */}
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => toggleItem.mutate({ itemId: item.id, field: 'is_cut', value: !item.is_cut, spoolId: id })}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                      item.is_cut
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                        : 'border-surface-600 text-surface-600 hover:border-surface-500'
                    }`}
                  >
                    {item.is_cut && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Fitted toggle */}
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => toggleItem.mutate({ itemId: item.id, field: 'is_fitted', value: !item.is_fitted, spoolId: id })}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                      item.is_fitted
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'border-surface-600 text-surface-600 hover:border-surface-500'
                    }`}
                  >
                    {item.is_fitted && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <span className="col-span-2 text-surface-500 font-mono text-xs hidden sm:block truncate">
                  {item.heat_number ?? '—'}
                </span>

                {/* Delete (hover only) */}
                <button
                  onClick={() => deleteItem.mutate({ itemId: item.id, spoolId: id })}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-red-400/60 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Linked Welds ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Welds on this Spool
          </h2>
          <Link
            href={`/welds/new?spoolNumber=${s.spool_number}&projectId=${s.project_id}`}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Flame className="w-3.5 h-3.5" /> Log Weld
          </Link>
        </div>

        {linkedWelds.length === 0 ? (
          <p className="text-sm text-surface-600 text-center py-6">
            No welds logged for spool {s.spool_number} yet.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedWelds.map((w: any) => (
              <Link
                key={w.id}
                href={`/welds/${w.id}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-700/50 transition-colors"
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-surface-200">{w.weld_id_number}</span>
                  {w.welder_stamp && (
                    <span className="ml-2 text-xs text-brand-400 font-mono">{w.welder_stamp}</span>
                  )}
                  {w.welder_name && (
                    <span className="ml-2 text-xs text-surface-500">{w.welder_name}</span>
                  )}
                </div>
                <WeldStatusBadge status={w.status as WeldStatus} size="sm" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── QR Code Modal ── */}
      <QRCodeModal
        open={showQR}
        onClose={() => setShowQR(false)}
        url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/spools/${s.id}`}
        label={`Spool ${s.spool_number}`}
        subtitle={s.pipe_size ?? ''}
      />

      {/* ── Status Update Modal ── */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-surface-50">Advance Spool Status</h2>

            <div>
              <label className="label">New Status</label>
              <div className="grid grid-cols-1 gap-2">
                {nextStatuses.map(ns => (
                  <button
                    key={ns}
                    onClick={() => setNewStatus(ns)}
                    className={`
                      text-left p-3 rounded-xl border transition-all text-sm font-medium
                      ${newStatus === ns
                        ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                        : 'border-surface-600 hover:border-surface-500 text-surface-300'}
                    `}
                  >
                    {SPOOL_STATUS_LABELS[ns]}
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
                placeholder="Inspector name, cert #, hold points…"
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
                {updateStatus.isPending ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
