'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Filter, X, Upload, CheckSquare, Download } from 'lucide-react'
import { useWelds, useWeldsRealtime } from '@/hooks/useWelds'
import { useAuth } from '@/hooks/useAuth'
import { usePrefetchWeld } from '@/hooks/usePrefetch'
import { WeldCard } from '@/components/welds/WeldCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useProjects } from '@/hooks/useProjects'
import { WELD_STATUS_LABELS, type WeldStatus } from '@/types'
import { QRScanButton } from '@/components/shared/QRScanButton'
import { ImportWeldsModal } from '@/components/welds/ImportWeldsModal'
import { QuickAddWeldPanel } from '@/components/welds/QuickAddWeldPanel'
import type { QRScanResult } from '@/hooks/useQRScanner'
import { cn } from '@/lib/utils'

const ALL_STATUSES = Object.keys(WELD_STATUS_LABELS) as WeldStatus[]

const PAGE_SIZE = 25

export default function WeldsPage() {
  const router       = useRouter()
  const queryClient  = useQueryClient()
  const { profile }  = useAuth()
  useWeldsRealtime(profile?.organization_id)
  const prefetchWeld = usePrefetchWeld()
  const [search,      setSearch]      = useState('')
  const [status,      setStatus]      = useState<WeldStatus | ''>('')
  const [projectId,   setProjectId]   = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page,        setPage]        = useState(1)
  const [showImport,   setShowImport]   = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // ── Bulk selection state ──────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [bulkMode,       setBulkMode]       = useState(false)
  const [showBulkModal,  setShowBulkModal]  = useState(false)
  const [bulkStatus,     setBulkStatus]     = useState<WeldStatus | ''>('')
  const [bulkNotes,      setBulkNotes]      = useState('')
  const [bulkLoading,    setBulkLoading]    = useState(false)
  const [bulkError,      setBulkError]      = useState<string | null>(null)

  function handleQRResult(result: QRScanResult) {
    if (result.type === 'weld') {
      setSearch(result.weldNumber)
    } else if (result.type === 'calc') {
      const params = new URLSearchParams({ nps: result.nps, schedule: result.schedule, fluid: result.fluid })
      router.push(`/pipe-support?${params.toString()}`)
    }
  }

  const { data, isLoading, isError } = useWelds({
    search:    search    || undefined,
    status:    status    || undefined,
    projectId: projectId || undefined,
    page,
  })
  const welds      = data?.welds as Array<Record<string, unknown>> | undefined
  const totalCount = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const { data: projects } = useProjects()

  const hasFilters = !!search || !!status || !!projectId

  function clearFilters() {
    setSearch('')
    setStatus('')
    setProjectId('')
    setPage(1)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (!welds) return
    setSelectedIds(new Set(welds.map(w => w.id as string)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function exitBulkMode() {
    setBulkMode(false)
    setSelectedIds(new Set())
    setBulkError(null)
  }

  async function handleBulkUpdate() {
    if (!bulkStatus || selectedIds.size === 0) return
    setBulkLoading(true)
    setBulkError(null)
    try {
      const res = await fetch('/api/welds/bulk-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          weldIds:   Array.from(selectedIds),
          newStatus: bulkStatus,
          notes:     bulkNotes || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Failed to update welds')
      }
      setShowBulkModal(false)
      setBulkStatus('')
      setBulkNotes('')
      exitBulkMode()
      queryClient.invalidateQueries({ queryKey: ['welds'] })
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBulkLoading(false)
    }
  }

  function exportSelectedCSV() {
    if (!welds || selectedIds.size === 0) return
    const selected = welds.filter(w => selectedIds.has(w.id as string))
    const headers = ['weld_id_number', 'status', 'welder_stamp', 'welder_name', 'weld_date', 'spool_number', 'notes']
    const rows = selected.map(w =>
      headers.map(h => {
        const val = w[h]
        if (val === null || val === undefined) return ''
        const s = String(val)
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    )
    const csv  = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `welds-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Welds</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Track, inspect, and manage all field welds
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!bulkMode && (
            <button
              onClick={() => setBulkMode(true)}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Select</span>
            </button>
          )}
          <QRScanButton onResult={handleQRResult} label="Scan" />
          <button
            onClick={() => setShowImport(true)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <Link href="/welds/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Weld</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {/* ── Bulk selection info bar ── */}
      {bulkMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-blue-950/60 border border-blue-700/40 px-4 py-3 text-sm">
          <span className="text-blue-200 font-medium">
            {selectedIds.size} weld{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {welds && welds.length > 0 && selectedIds.size < welds.length && (
              <button onClick={selectAll} className="btn-ghost text-xs py-1 px-2">
                Select All ({welds.length})
              </button>
            )}
            {selectedIds.size > 0 && (
              <button onClick={deselectAll} className="btn-ghost text-xs py-1 px-2">
                Deselect All
              </button>
            )}
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={exportSelectedCSV}
                  className="btn-ghost flex items-center gap-1.5 text-xs py-1 px-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Selected
                </button>
                <button
                  onClick={() => { setBulkError(null); setShowBulkModal(true) }}
                  className="btn-primary text-xs py-1 px-3"
                >
                  Update Status
                </button>
              </>
            )}
            <button onClick={exitBulkMode} className="btn-ghost text-xs py-1 px-2 text-surface-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Search + Filter bar ── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search weld ID, welder, spool…"
              className="input pl-9 w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn-ghost flex items-center gap-2 relative ${showFilters ? 'text-brand-400 border-brand-500/40' : ''}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-500 rounded-full" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as WeldStatus | '')}
                className="input"
              >
                <option value="">All statuses</option>
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{WELD_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Project</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="input"
              >
                <option value="">All projects</option>
                {projects?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <div className="sm:col-span-2 flex justify-end">
                <button onClick={clearFilters} className="btn-ghost text-sm flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="card p-6 text-center text-red-400">
          Failed to load welds. Please refresh.
        </div>
      )}

      {!isLoading && !isError && welds?.length === 0 && (
        <EmptyState
          icon="🔧"
          title={hasFilters ? 'No welds match your filters' : 'No welds yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or filters.'
              : 'Start tracking your first weld by clicking "New Weld".'
          }
          action={
            hasFilters
              ? { label: 'Clear filters', onClick: clearFilters }
              : { label: 'Create First Weld', href: '/welds/new' }
          }
        />
      )}

      {!isLoading && welds && welds.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-600">
              {totalCount} weld{totalCount !== 1 ? 's' : ''} found
              {totalPages > 1 && ` — page ${page} of ${totalPages}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost px-3 py-1 text-sm disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="text-xs text-surface-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-ghost px-3 py-1 text-sm disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {welds.map(w => {
              const weldId      = w.id as string
              const weldProps   = {
                id:            weldId,
                weldIdNumber:  w.weld_id_number as string,
                status:        w.status as WeldStatus,
                welderStamp:   (w.welder_stamp as string | null) ?? null,
                welderName:    (w.welder_name as string | null) ?? null,
                weldDate:      (w.weld_date as string | null) ?? null,
                projectName:   (w.projects as { name: string } | null)?.name ?? '—',
                spoolNumber:   (w.spool_number as string | null) ?? null,
                notes:         (w.notes as string | null) ?? null,
                photoCount:    ((w.weld_photos as unknown[] | null)?.length) ?? 0,
                onMouseEnter:  () => prefetchWeld(weldId),
              }

              const onStatusUpdate = () => queryClient.invalidateQueries({ queryKey: ['welds'] })

              if (bulkMode) {
                return (
                  <div className="relative" key={weldId}>
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(weldId)}
                        onChange={() => toggleSelect(weldId)}
                        className="w-4 h-4 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    <div className={cn(selectedIds.has(weldId) ? 'ring-2 ring-brand-500 rounded-xl' : '')}>
                      <WeldCard {...weldProps} onStatusUpdate={onStatusUpdate} />
                    </div>
                  </div>
                )
              }

              return <WeldCard key={weldId} {...weldProps} onStatusUpdate={onStatusUpdate} />
            })}
          </div>
        </>
      )}
    </div>

    {/* ── Quick-Add floating button ── */}
    {!bulkMode && (
      <button
        type="button"
        aria-label="Quick-add weld"
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-500 shadow-glow flex items-center justify-center text-white hover:bg-brand-400 active:scale-95 transition-all duration-150"
      >
        <Plus className="w-6 h-6" />
      </button>
    )}

    {/* ── Quick-Add Weld Panel ── */}
    <QuickAddWeldPanel
      open={showQuickAdd}
      onClose={() => setShowQuickAdd(false)}
      onCreated={() => {
        setShowQuickAdd(false)
        queryClient.invalidateQueries({ queryKey: ['welds'] })
      }}
    />

    {/* ── Import Modal ── */}
    {showImport && (
      <ImportWeldsModal
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          setShowImport(false)
          queryClient.invalidateQueries({ queryKey: ['welds'] })
        }}
      />
    )}

    {/* ── Bulk Status Update Modal ── */}
    {showBulkModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="card w-full max-w-md p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-surface-50">
              Update {selectedIds.size} Weld{selectedIds.size !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={() => setShowBulkModal(false)}
              className="text-surface-500 hover:text-surface-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">New Status <span className="text-red-400">*</span></label>
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value as WeldStatus | '')}
                className="input"
              >
                <option value="">Select a status…</option>
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{WELD_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Notes <span className="text-surface-500">(optional)</span></label>
              <textarea
                value={bulkNotes}
                onChange={e => setBulkNotes(e.target.value)}
                placeholder="Add a note for this status change…"
                rows={3}
                maxLength={500}
                className="input resize-none"
              />
              <p className="text-xs text-surface-600 mt-1 text-right">{bulkNotes.length}/500</p>
            </div>
          </div>

          {bulkError && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {bulkError}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowBulkModal(false)}
              className="btn-ghost"
              disabled={bulkLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleBulkUpdate}
              disabled={!bulkStatus || bulkLoading}
              className="btn-primary disabled:opacity-50"
            >
              {bulkLoading
                ? 'Updating…'
                : `Update ${selectedIds.size} Weld${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
