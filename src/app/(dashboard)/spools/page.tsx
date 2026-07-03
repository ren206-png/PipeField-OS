'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, X } from 'lucide-react'
import { useSpools } from '@/hooks/useSpools'
import { useProjects } from '@/hooks/useProjects'
import { usePrefetchSpool } from '@/hooks/usePrefetch'
import { SpoolCard } from '@/components/spools/SpoolCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { SPOOL_STATUS_LABELS, type SpoolStatus } from '@/types'

const ALL_STATUSES = Object.keys(SPOOL_STATUS_LABELS) as SpoolStatus[]

const PAGE_SIZE = 25

export default function SpoolsPage() {
  const prefetchSpool = usePrefetchSpool()
  const [search,      setSearch]      = useState('')
  const [status,      setStatus]      = useState<SpoolStatus | ''>('')
  const [projectId,   setProjectId]   = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page,        setPage]        = useState(1)

  const { data, isLoading, isError } = useSpools({
    search:    search    || undefined,
    status:    status    || undefined,
    projectId: projectId || undefined,
    page,
  })

  const { data: projects } = useProjects()
  const spools     = data?.spools
  const totalCount = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasFilters = !!search || !!status || !!projectId

  function clearFilters() {
    setSearch('')
    setStatus('')
    setProjectId('')
    setPage(1)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Spools</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Track fabrication from design to field release
          </p>
        </div>
        <Link href="/spools/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Spool</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* ── Search + Filters ── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search spool #, area, iso ref…"
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
                onChange={e => setStatus(e.target.value as SpoolStatus | '')}
                className="input"
              >
                <option value="">All statuses</option>
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{SPOOL_STATUS_LABELS[s]}</option>
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
          Failed to load spools. Please refresh.
        </div>
      )}

      {!isLoading && !isError && spools?.length === 0 && (
        <EmptyState
          icon="🔩"
          title={hasFilters ? 'No spools match your filters' : 'No spools yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or filters.'
              : 'Create your first spool to start tracking fabrication progress.'
          }
          action={
            hasFilters
              ? { label: 'Clear filters', onClick: clearFilters }
              : { label: 'Create First Spool', href: '/spools/new' }
          }
        />
      )}

      {!isLoading && spools && spools.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-600">
              {totalCount} spool{totalCount !== 1 ? 's' : ''} found
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
            {(spools as Array<Record<string, unknown>>).map(s => (
              <SpoolCard
                key={s.id as string}
                id={s.id as string}
                spoolNumber={s.spool_number as string}
                revision={(s.revision as string | null) ?? null}
                status={s.status as SpoolStatus}
                projectName={(s.projects as { name: string } | null)?.name ?? '—'}
                pipeSize={(s.pipe_size as string | null) ?? null}
                material={(s.material as string | null) ?? null}
                area={(s.area as string | null) ?? null}
                isometricRef={(s.isometric_ref as string | null) ?? null}
                totalWelds={(s.total_welds as number | null) ?? 0}
                itemCount={((s.spool_items as unknown[] | null)?.length) ?? 0}
                requiredDate={(s.required_date as string | null) ?? null}
                priority={(s.priority as number | null) ?? 5}
                onMouseEnter={() => prefetchSpool(s.id as string)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
