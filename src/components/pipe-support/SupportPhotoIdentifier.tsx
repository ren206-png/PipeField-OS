'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import {
  enqueuePhoto,
  getAllQueuedPhotos,
  deleteQueuedPhoto,
  markPhotoSynced,
  markPhotoFailed,
  purgeExpiredPhotos,
  clearCompleted,
  type SupportPhotoQueueItem,
} from '@/lib/support-photo-queue'

// ── Types ──────────────────────────────────────────────────────

interface Props {
  enabled: boolean   // SUPPORT_PHOTO_ID_ENABLED from server
}

type IdentifyStatus = 'MATCH' | 'UNIDENTIFIED' | 'PHOTO_EXPIRED'

interface IdentifyResult {
  status: IdentifyStatus
  confidence?: number
  visual_indicators?: string[]
  component_name?: string
}

interface SyncResult {
  client_photo_id: string
  result?: IdentifyResult
  error?: string
}

const DISCLAIMER = 'AI pre-identification only. Verify against isometrics and support drawings. Not an engineering determination.'
const MAX_FILE_BYTES = 5 * 1024 * 1024  // 5 MB

// ── Helpers ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function StatusBadge({ status }: { status: SupportPhotoQueueItem['sync_status'] }) {
  const map: Record<typeof status, { label: string; cls: string }> = {
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    synced:   { label: 'Synced',   cls: 'bg-green-100 text-green-800 border-green-300' },
    failed:   { label: 'Failed',   cls: 'bg-red-100 text-red-800 border-red-300' },
    expired:  { label: 'Expired',  cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

function DisclaimerBanner() {
  return (
    <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
      <span className="text-amber-500 mt-0.5 text-sm">⚠</span>
      <p className="text-xs text-amber-800 leading-relaxed">{DISCLAIMER}</p>
    </div>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">Confidence</span>
        <span className="text-xs font-semibold text-slate-700">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export function SupportPhotoIdentifier({ enabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isOnline, setIsOnline]       = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult]           = useState<IdentifyResult | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [queuedItems, setQueuedItems] = useState<SupportPhotoQueueItem[]>([])
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])
  const [queuedFileName, setQueuedFileName] = useState<string | null>(null)

  // Refresh the queued items display
  const refreshQueue = useCallback(async () => {
    try {
      const items = await getAllQueuedPhotos()
      setQueuedItems(items)
    } catch {
      // IndexedDB may not be available in SSR or certain environments
    }
  }, [])

  // Sync pending photos to the server
  const syncPending = useCallback(async () => {
    try {
      await purgeExpiredPhotos()
      const items = await getAllQueuedPhotos()
      const pending = items
        .filter(i => i.sync_status === 'pending')
        .sort((a, b) => new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime())

      const results: SyncResult[] = []
      for (const item of pending) {
        try {
          const formData = new FormData()
          formData.append('file', item.blob)
          formData.append('client_photo_id', item.client_photo_id)
          formData.append('captured_at_client', item.captured_at_client)

          const res = await apiFetch('/api/v1/supports/identify', {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) {
            const msg = `Server error ${res.status}`
            await markPhotoFailed(item.client_photo_id, msg)
            results.push({ client_photo_id: item.client_photo_id, error: msg })
          } else {
            const data = (await res.json()) as IdentifyResult
            await markPhotoSynced(item.client_photo_id)
            results.push({ client_photo_id: item.client_photo_id, result: data })
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          await markPhotoFailed(item.client_photo_id, msg)
          results.push({ client_photo_id: item.client_photo_id, error: msg })
        }
      }

      if (results.length > 0) {
        await clearCompleted()
        setSyncResults(prev => [...results, ...prev])
      }

      await refreshQueue()
    } catch {
      // Sync errors are surfaced per-item above
    }
  }, [refreshQueue])

  // On mount: initialise online state, load queue, run expiry, register listener
  useEffect(() => {
    if (!enabled) return

    setIsOnline(navigator.onLine)
    void refreshQueue()
    void purgeExpiredPhotos().then(() => refreshQueue())

    const handleOnline = () => {
      setIsOnline(true)
      void syncPending()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // If already online on mount, attempt sync of any queued items
    if (navigator.onLine) {
      void syncPending()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enabled, refreshQueue, syncPending])

  if (!enabled) return null

  // ── File selection handler ─────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target.files) return
    // Reset input so same file can be re-selected
    e.target.value = ''
    if (!file) return

    setError(null)
    setResult(null)
    setQueuedFileName(null)

    // Size guard
    if (file.size > MAX_FILE_BYTES) {
      setError(`File too large — maximum 5 MB (this file is ${formatBytes(file.size)}).`)
      return
    }

    // Offline path
    if (!navigator.onLine) {
      try {
        await enqueuePhoto(file)
        setQueuedFileName(file.name)
        await refreshQueue()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to queue photo.')
      }
      return
    }

    // Online path
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('client_photo_id', crypto.randomUUID())
      formData.append('captured_at_client', new Date().toISOString())

      const res = await apiFetch('/api/v1/supports/identify', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`)
      }

      const data = (await res.json()) as IdentifyResult
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteQueuedPhoto(id)
    await refreshQueue()
  }

  // ── Render ─────────────────────────────────────────────────

  const pendingItems = queuedItems.filter(i => i.sync_status === 'pending')

  return (
    <div className="mt-8 space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Photo Identification</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Capture or upload a photo to identify a pipe support component.
          </p>
        </div>
        {!isOnline && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Offline — photos will be queued
          </span>
        )}
      </div>

      {/* Camera / file trigger */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
            text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isUploading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <span className="text-base leading-none">📷</span>
              Identify from Photo
            </>
          )}
        </button>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Accepts JPEG, PNG, WebP · Max 5 MB
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
          <span className="text-red-500 text-sm mt-0.5">✕</span>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Queued confirmation */}
      {queuedFileName && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-slate-500 text-sm mt-0.5">📋</span>
          <p className="text-xs text-slate-700">
            <span className="font-semibold">Queued — will identify when online.</span>
            {' '}{queuedFileName}
          </p>
        </div>
      )}

      {/* Online identification result */}
      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {result.status === 'MATCH' && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300 mb-2">
                    Match found
                  </span>
                  {result.component_name && (
                    <h4 className="text-sm font-bold text-slate-900">{result.component_name}</h4>
                  )}
                </div>
              </div>
              {typeof result.confidence === 'number' && (
                <ConfidenceBar confidence={result.confidence} />
              )}
              {result.visual_indicators && result.visual_indicators.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Visual Indicators
                  </p>
                  <ul className="space-y-1">
                    {result.visual_indicators.map((vi, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                        <span className="mt-0.5 text-indigo-400">•</span>
                        {vi}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {result.status === 'UNIDENTIFIED' && (
            <p className="text-sm text-slate-700">
              Component not identified in catalog. Please identify manually.
            </p>
          )}

          {result.status === 'PHOTO_EXPIRED' && (
            <p className="text-sm text-slate-700">
              Photo is too old to process.
            </p>
          )}

          <DisclaimerBanner />
        </div>
      )}

      {/* Pending Photos queue */}
      {pendingItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Pending Photos ({pendingItems.length})
            </h4>
          </div>
          <ul className="divide-y divide-slate-100">
            {pendingItems.map((item, idx) => (
              <li key={item.client_photo_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    Photo #{idx + 1}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatTime(item.captured_at_client)} · {formatBytes(item.size_bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={item.sync_status} />
                  <button
                    onClick={() => handleDelete(item.client_photo_id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete queued photo"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Offline sync results */}
      {syncResults.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Pending Identifications
            </h4>
          </div>
          <ul className="divide-y divide-slate-100">
            {syncResults.map((sr, idx) => (
              <li key={`${sr.client_photo_id}-${idx}`} className="px-4 py-3">
                <p className="text-xs text-slate-500 mb-2">Photo — {sr.client_photo_id.slice(0, 8)}…</p>
                {sr.error ? (
                  <p className="text-xs text-red-600">{sr.error}</p>
                ) : sr.result ? (
                  <>
                    {sr.result.status === 'MATCH' && (
                      <>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300 mb-2">
                          Match found
                        </span>
                        {sr.result.component_name && (
                          <p className="text-sm font-bold text-slate-900">{sr.result.component_name}</p>
                        )}
                        {typeof sr.result.confidence === 'number' && (
                          <ConfidenceBar confidence={sr.result.confidence} />
                        )}
                        {sr.result.visual_indicators && sr.result.visual_indicators.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {sr.result.visual_indicators.map((vi, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                                <span className="mt-0.5 text-indigo-400">•</span>
                                {vi}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                    {sr.result.status === 'UNIDENTIFIED' && (
                      <p className="text-sm text-slate-700">Component not identified in catalog. Please identify manually.</p>
                    )}
                    {sr.result.status === 'PHOTO_EXPIRED' && (
                      <p className="text-sm text-slate-700">Photo is too old to process.</p>
                    )}
                    <DisclaimerBanner />
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
