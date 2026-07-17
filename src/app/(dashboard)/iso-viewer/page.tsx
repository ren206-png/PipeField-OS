'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import { Map, ArrowLeft, Upload, Plus, X, Info, Trash2, Eye } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  project_number: string | null
}

interface IsoDrawing {
  id: string
  drawing_number: string
  revision: string
  title: string | null
  file_type: string
  storage_path: string
  created_at: string
}

interface WeldPin {
  id: string
  weld_number_label: string
  x_pct: number
  y_pct: number
  page_number: number
  weld_id: string | null
  created_at: string
  welds: {
    id: string
    weld_id_number: string
    status: string
    welder_name: string | null
    weld_date: string | null
    wps_id: string | null
  } | null
}

interface Weld {
  id: string
  weld_id_number: string
  status: string
}

interface PendingPin {
  x_pct: number
  y_pct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pinColor(status?: string): string {
  switch (status) {
    case 'accepted':  return '#22c55e'
    case 'pending':   return '#f59e0b'
    case 'rejected':  return '#ef4444'
    default:          return '#6b7280'
  }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}

function UploadModal({ projectId, onClose, onSuccess }: UploadModalProps) {
  const [drawingNumber, setDrawingNumber] = useState('')
  const [revision, setRevision] = useState('A')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !drawingNumber) return
    setErr(null)
    setUploading(true)

    const fd = new FormData()
    fd.append('project_id', projectId)
    fd.append('drawing_number', drawingNumber)
    fd.append('revision', revision)
    if (title) fd.append('title', title)
    fd.append('file', file)

    const res = await apiFetch('/api/iso/drawings', { method: 'POST', body: fd })
    setUploading(false)

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? `Upload failed (${res.status})`)
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <h2 className="text-base font-semibold text-surface-100">Upload Drawing</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Drawing Number *</label>
            <input
              className="input w-full"
              value={drawingNumber}
              onChange={e => setDrawingNumber(e.target.value)}
              placeholder="e.g. ISO-101"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Revision</label>
            <input
              className="input w-full"
              value={revision}
              onChange={e => setRevision(e.target.value)}
              placeholder="A"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Title</label>
            <input
              className="input w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Optional title"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">File * (PDF, PNG, JPG, JPEG — max 20MB)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-ghost w-full flex items-center gap-2 justify-center"
            >
              <Upload className="w-4 h-4" />
              {file ? file.name : 'Choose file'}
            </button>
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!file || !drawingNumber || uploading}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Pin Form (mini form shown after clicking image) ──────────────────────────

interface PinFormProps {
  pending: PendingPin
  drawingId: string
  projectWelds: Weld[]
  onClose: () => void
  onSuccess: () => void
}

function PinForm({ pending, drawingId, projectWelds, onClose, onSuccess }: PinFormProps) {
  const [label, setLabel] = useState('')
  const [weldId, setWeldId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!label) return
    setSaving(true)
    setErr(null)

    const body = {
      weld_number_label: label,
      x_pct: pending.x_pct,
      y_pct: pending.y_pct,
      page_number: 1,
      weld_id: weldId || null,
    }

    const res = await apiFetch(`/api/iso/drawings/${drawingId}/pins`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setSaving(false)

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? 'Failed to save pin')
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <div
      className="absolute z-20 bg-surface-800 border border-surface-600 rounded-lg shadow-xl p-3 w-56"
      style={{ left: `${pending.x_pct}%`, top: `${pending.y_pct}%`, transform: 'translate(-50%, -110%)' }}
    >
      <form onSubmit={handleSave} className="space-y-2">
        <p className="text-xs font-semibold text-surface-300">Add Weld Pin</p>
        <input
          className="input w-full text-xs"
          placeholder="Weld label *"
          value={label}
          onChange={e => setLabel(e.target.value)}
          autoFocus
          required
        />
        {projectWelds.length > 0 && (
          <select
            className="input w-full text-xs"
            value={weldId}
            onChange={e => setWeldId(e.target.value)}
          >
            <option value="">— Link weld (optional) —</option>
            {projectWelds.map(w => (
              <option key={w.id} value={w.id}>{w.weld_id_number}</option>
            ))}
          </select>
        )}
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 text-xs py-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1 text-xs py-1" disabled={!label || saving}>
            {saving ? '…' : 'Place'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Pin Popover ──────────────────────────────────────────────────────────────

interface PinPopoverProps {
  pin: WeldPin
  onClose: () => void
  onDelete: (pinId: string) => void
}

function PinPopover({ pin, onClose, onDelete }: PinPopoverProps) {
  return (
    <div
      className="absolute z-20 bg-surface-800 border border-surface-600 rounded-lg shadow-xl p-3 w-60"
      style={{ left: `${pin.x_pct}%`, top: `${pin.y_pct}%`, transform: 'translate(-50%, -110%)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-surface-100">{pin.weld_number_label}</p>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {pin.welds ? (
        <div className="text-xs space-y-1 text-surface-300">
          <p><span className="text-surface-500">Weld #:</span> {pin.welds.weld_id_number}</p>
          <p>
            <span className="text-surface-500">Status:</span>{' '}
            <span style={{ color: pinColor(pin.welds.status) }} className="font-medium capitalize">
              {pin.welds.status}
            </span>
          </p>
          {pin.welds.welder_name && (
            <p><span className="text-surface-500">Welder:</span> {pin.welds.welder_name}</p>
          )}
          {pin.welds.weld_date && (
            <p><span className="text-surface-500">Date:</span> {formatDate(pin.welds.weld_date)}</p>
          )}
          {pin.welds.wps_id && (
            <p><span className="text-surface-500">WPS:</span> {pin.welds.wps_id}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-surface-500">No linked weld record.</p>
      )}
      <button
        onClick={() => { onDelete(pin.id); onClose() }}
        className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300 py-1 rounded hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Remove pin
      </button>
    </div>
  )
}

// ─── Image Viewer with overlay pins ───────────────────────────────────────────

interface ImageViewerProps {
  drawing: IsoDrawing
  signedUrl: string
  pins: WeldPin[]
  projectWelds: Weld[]
  onPinAdded: () => void
  onPinDeleted: () => void
}

function ImageViewer({ drawing, signedUrl, pins, projectWelds, onPinAdded, onPinDeleted }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [addingPin, setAddingPin] = useState(false)
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null)
  const [activePin, setActivePin] = useState<WeldPin | null>(null)

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!addingPin) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x_pct = ((e.clientX - rect.left) / rect.width) * 100
    const y_pct = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPin({ x_pct, y_pct })
    setAddingPin(false)
  }, [addingPin])

  async function deletePin(pinId: string) {
    const res = await apiFetch(`/api/iso/drawings/${drawing.id}/pins/${pinId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      onPinDeleted()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setAddingPin(a => !a); setPendingPin(null); setActivePin(null) }}
          className={addingPin ? 'btn-primary' : 'btn-ghost'}
        >
          <Plus className="w-4 h-4 mr-1" />
          {addingPin ? 'Click drawing to place pin…' : 'Add Weld Pin'}
        </button>
        {addingPin && (
          <button onClick={() => setAddingPin(false)} className="btn-ghost text-sm">
            Cancel
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className={`relative inline-block w-full ${addingPin ? 'cursor-crosshair' : ''}`}
        onClick={handleImageClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={`${drawing.drawing_number} Rev ${drawing.revision}`}
          className="w-full h-auto rounded-lg border border-surface-700"
          draggable={false}
        />

        {/* Existing pins */}
        {pins.map(pin => (
          <button
            key={pin.id}
            title={pin.weld_number_label}
            onClick={e => { e.stopPropagation(); setActivePin(p => p?.id === pin.id ? null : pin); setPendingPin(null) }}
            style={{
              position: 'absolute',
              left: `${pin.x_pct}%`,
              top: `${pin.y_pct}%`,
              transform: 'translate(-50%, -50%)',
              background: pinColor(pin.welds?.status),
            }}
            className="w-5 h-5 rounded-full border-2 border-white shadow-md hover:scale-125 transition-transform flex items-center justify-center z-10"
          >
            <span className="sr-only">{pin.weld_number_label}</span>
          </button>
        ))}

        {/* Labels for pins */}
        {pins.map(pin => (
          <span
            key={`lbl-${pin.id}`}
            style={{
              position: 'absolute',
              left: `${pin.x_pct}%`,
              top: `${pin.y_pct}%`,
              transform: 'translate(-50%, 8px)',
              pointerEvents: 'none',
            }}
            className="text-[10px] font-bold text-white bg-black/70 rounded px-1 leading-tight whitespace-nowrap z-10"
          >
            {pin.weld_number_label}
          </span>
        ))}

        {/* Active pin popover */}
        {activePin && (
          <PinPopover
            pin={activePin}
            onClose={() => setActivePin(null)}
            onDelete={deletePin}
          />
        )}

        {/* Pending pin form */}
        {pendingPin && (
          <PinForm
            pending={pendingPin}
            drawingId={drawing.id}
            projectWelds={projectWelds}
            onClose={() => setPendingPin(null)}
            onSuccess={() => { setPendingPin(null); onPinAdded() }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Viewer Mode ──────────────────────────────────────────────────────────────

interface ViewerProps {
  drawing: IsoDrawing
  projectId: string
  onBack: () => void
}

function Viewer({ drawing, projectId, onBack }: ViewerProps) {
  const qc = useQueryClient()

  const { data: urlData } = useQuery({
    queryKey: ['iso-drawing-url', drawing.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/iso/drawings/${drawing.id}/url`)
      if (!res.ok) throw new Error('Failed to get signed URL')
      return res.json() as Promise<{ url: string }>
    },
    staleTime: 3000 * 1000, // 50min (URL expires in 60min)
  })

  const { data: pins = [], refetch: refetchPins } = useQuery({
    queryKey: ['iso-pins', drawing.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/iso/drawings/${drawing.id}/pins`)
      if (!res.ok) throw new Error('Failed to load pins')
      return res.json() as Promise<WeldPin[]>
    },
  })

  const { data: projectWelds = [] } = useQuery({
    queryKey: ['project-welds-for-pins', projectId],
    queryFn: async () => {
      const res = await apiFetch(`/api/welds?project_id=${projectId}&limit=500`)
      if (!res.ok) return []
      const j = await res.json() as { data?: Weld[] } | Weld[]
      return Array.isArray(j) ? j : (j.data ?? [])
    },
  })

  const isPdf = drawing.file_type === 'pdf'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-ghost flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to drawings
        </button>
        <div>
          <h2 className="text-lg font-semibold text-surface-100">
            {drawing.drawing_number} Rev {drawing.revision}
            {drawing.title && <span className="text-surface-400 text-sm ml-2">— {drawing.title}</span>}
          </h2>
        </div>
      </div>

      {isPdf && (
        <div className="flex items-start gap-2 px-4 py-3 bg-brand-500/10 border border-brand-500/20 rounded-lg text-sm text-brand-300">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Pin placement is available for PNG/JPG drawings. PDF drawings display as read-only.</span>
        </div>
      )}

      {!urlData ? (
        <div className="h-96 bg-surface-800 rounded-lg animate-pulse" />
      ) : isPdf ? (
        <iframe
          src={urlData.url}
          className="w-full h-[600px] rounded-lg border border-surface-700"
          title={`${drawing.drawing_number} Rev ${drawing.revision}`}
        />
      ) : (
        <ImageViewer
          drawing={drawing}
          signedUrl={urlData.url}
          pins={pins}
          projectWelds={projectWelds}
          onPinAdded={() => { void refetchPins(); void qc.invalidateQueries({ queryKey: ['iso-pins', drawing.id] }) }}
          onPinDeleted={() => { void refetchPins(); void qc.invalidateQueries({ queryKey: ['iso-pins', drawing.id] }) }}
        />
      )}

      {/* Pins list sidebar */}
      {!isPdf && pins.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3">Weld Pins ({pins.length})</h3>
          <div className="space-y-2">
            {pins.map(pin => (
              <div key={pin.id} className="flex items-center gap-3 text-sm">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: pinColor(pin.welds?.status) }}
                />
                <span className="text-surface-200 font-medium">{pin.weld_number_label}</span>
                {pin.welds && (
                  <span className="text-surface-500 text-xs capitalize">{pin.welds.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Drawing List ─────────────────────────────────────────────────────────────

interface DrawingListProps {
  projectId: string
  onView: (drawing: IsoDrawing) => void
}

function DrawingList({ projectId, onView }: DrawingListProps) {
  const qc = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)

  const { data: drawings = [], isLoading } = useQuery({
    queryKey: ['iso-drawings', projectId],
    queryFn: async () => {
      const res = await apiFetch(`/api/iso/drawings?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to load drawings')
      return res.json() as Promise<IsoDrawing[]>
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/iso/drawings/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('Delete failed')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iso-drawings', projectId] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-surface-200">ISO Drawings</h2>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload Drawing
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-surface-800 rounded-lg animate-pulse" />)}
        </div>
      ) : drawings.length === 0 ? (
        <div className="card p-8 text-center">
          <Map className="w-8 h-8 text-surface-600 mx-auto mb-2" />
          <p className="text-surface-400 text-sm">No drawings uploaded yet.</p>
          <p className="text-surface-600 text-xs mt-1">Upload a PDF or image to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">Drawing #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">Rev</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {drawings.map(d => (
                <tr key={d.id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-surface-100">{d.drawing_number}</td>
                  <td className="px-4 py-3 text-surface-300">{d.revision}</td>
                  <td className="px-4 py-3 text-surface-400">{d.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-700 text-surface-300 uppercase">
                      {d.file_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-surface-500 text-xs">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onView(d)}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this drawing?')) deleteMutation.mutate(d.id) }}
                        className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          projectId={projectId}
          onClose={() => setShowUpload(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['iso-drawings', projectId] })}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IsoViewerPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedDrawing, setSelectedDrawing] = useState<IsoDrawing | null>(null)

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects-for-iso'],
    queryFn: async () => {
      const res = await apiFetch('/api/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      const j = await res.json() as { data?: Project[] } | Project[]
      return Array.isArray(j) ? j : (j.data ?? [])
    },
  })

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedProjectId(e.target.value)
    setSelectedDrawing(null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-brand-500/10 border border-brand-500/20 rounded-lg flex items-center justify-center">
          <Map className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-50">ISO Viewer</h1>
          <p className="text-sm text-surface-500">Upload and annotate ISO drawings with weld pins</p>
        </div>
      </div>

      {/* Project selector */}
      {!selectedDrawing && (
        <div className="card p-4">
          <label className="block text-xs font-medium text-surface-400 mb-2">Select Project</label>
          {projectsLoading ? (
            <div className="h-10 bg-surface-800 rounded-lg animate-pulse w-64" />
          ) : (
            <select
              className="input w-full max-w-sm"
              value={selectedProjectId}
              onChange={handleProjectChange}
            >
              <option value="">— Choose a project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_number ? `${p.project_number} — ` : ''}{p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Content area */}
      {selectedDrawing ? (
        <Viewer
          drawing={selectedDrawing}
          projectId={selectedProjectId}
          onBack={() => setSelectedDrawing(null)}
        />
      ) : selectedProjectId ? (
        <DrawingList
          projectId={selectedProjectId}
          onView={d => setSelectedDrawing(d)}
        />
      ) : (
        <div className="card p-8 text-center">
          <Map className="w-10 h-10 text-surface-700 mx-auto mb-3" />
          <p className="text-surface-500 text-sm">Select a project to view or upload ISO drawings.</p>
        </div>
      )}
    </div>
  )
}
