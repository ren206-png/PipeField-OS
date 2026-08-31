'use client'
// ============================================================
// Field Mode — Reference Table Browser
// Fetches rows via anon client, caches in IndexedDB.
// Shows verified/confidence/rejected badges per row.
// RLS: ref tables have "read_all for authenticated" policy —
// anon client with active user session is sufficient.
// ============================================================
import React, { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getCachedRef, setCachedRef, getCacheDate } from '@/lib/field-mode/offline-reference-cache'
import { useFieldStrings } from '@/lib/field-mode/locale'

const RIGGING_TABLES = [
  'ref_shackles', 'ref_sling_leg_factors', 'ref_snatch_block_factors',
  'ref_wire_rope_slings', 'ref_synthetic_slings', 'ref_chain_slings',
]

interface PageProps {
  params: Promise<{ table: string }>
}

interface RefRecord {
  id: string
  verified: boolean | null
  recall_confidence: string | null
  rejected: boolean | null
  source_doc: string | null
  standard: string | null
  edition: string | null
  note?: string | null
  [key: string]: unknown
}

// Keys to exclude from the display (metadata columns)
const META_COLS = new Set([
  'id', 'verified', 'verified_by', 'verified_against', 'verified_at',
  'recall_confidence', 'rejected', 'rejected_note', 'source_doc', 'standard',
  'edition', 'source_page_or_table', 'import_batch_id', 'imported_at',
  'source_file_sha256', 'superseded_by_batch', 'source_dir', 'check_priority',
])

function RowBadges({ row }: { row: RefRecord }) {
  const t = useFieldStrings('en')
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {row.rejected && (
        <span className="px-2 py-0.5 rounded-full bg-red-900 text-red-300 text-[10px] font-semibold">
          {t.book_rejected_badge}
        </span>
      )}
      {!row.rejected && !row.verified && (
        <span className="px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 text-[10px] font-semibold">
          {t.book_unverified_badge}
        </span>
      )}
      {!row.rejected && row.recall_confidence === 'low' && (
        <span className="px-2 py-0.5 rounded-full bg-yellow-900/60 text-yellow-300 text-[10px] font-semibold">
          {t.book_low_confidence}
        </span>
      )}
    </div>
  )
}

export default function TableBrowserPage({ params }: PageProps) {
  const { table } = use(params)
  const t = useFieldStrings('en')
  const isRigging = RIGGING_TABLES.includes(table)

  const [rows, setRows]         = useState<RefRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [cacheDate, setCacheDate] = useState<Date | null>(null)
  const [search, setSearch]     = useState('')
  const [error, setError]       = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      // Check cache first
      const cached = await getCachedRef(table, {})
      if (cached) {
        setRows(cached as RefRecord[])
        const cd = await getCacheDate(table)
        setCacheDate(cd)
        setLoading(false)
        return
      }
      // Live fetch via anon client (RLS: read_all for authenticated)
      const supabase = createClient()
      const { data, error: dbError } = await supabase
        .from(table)
        .select('*')
        .order('id')
        .limit(500)
      if (dbError) { setError(dbError.message); return }
      const fetched = (data ?? []) as RefRecord[]
      setRows(fetched)
      await setCachedRef(table, {}, fetched)
      setCacheDate(new Date())
    } catch (e) {
      setError('Failed to load reference data')
    } finally {
      setLoading(false)
    }
  }, [table])

  useEffect(() => { fetchRows() }, [fetchRows])

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return Object.values(r).some(v => String(v ?? '').toLowerCase().includes(s))
  })

  function dataKeys(row: RefRecord): string[] {
    return Object.keys(row).filter(k => !META_COLS.has(k))
  }

  const displayName = table.replace('ref_', '').replace(/_/g, ' ')

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 bg-surface-950 border-b border-surface-800">
        <Link href="/field/book"
          className="min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl text-surface-300 active:bg-surface-800"
          aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-surface-100 capitalize">{displayName}</h1>
          {cacheDate && (
            <p className="text-xs text-surface-500">{t.book_cache_date(cacheDate.toLocaleDateString())}</p>
          )}
        </div>
      </div>

      {/* Rigging warning */}
      {isRigging && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-red-900/40 border border-red-700 text-red-300 text-sm">
          ⚠ {t.book_rigging_warning}
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.book_search_placeholder}
          className="w-full min-h-[56px] px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading && <p className="text-surface-400 text-sm mt-4">Loading…</p>}
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        {!loading && filtered.length === 0 && !error && (
          <p className="text-surface-500 text-sm mt-4">No rows found.</p>
        )}
        <div className="flex flex-col gap-2 mt-2">
          {filtered.map((row) => {
            const keys = dataKeys(row)
            return (
              <div
                key={row.id}
                className={`rounded-xl border p-3 ${
                  row.rejected
                    ? 'border-red-800 bg-red-950/30'
                    : 'border-surface-700 bg-surface-900'
                }`}
              >
                <RowBadges row={row} />
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {keys.map(k => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] text-surface-500 uppercase tracking-wide">{k.replace(/_/g,' ')}</span>
                      <span className="text-surface-200 text-sm font-mono">{String(row[k] ?? '—')}</span>
                    </div>
                  ))}
                </div>
                {/* Source footer */}
                {(row.standard || row.source_doc) && (
                  <p className="mt-2 text-[10px] text-surface-500">
                    {t.book_source_footer(row.standard ?? '', row.edition ?? '', row.source_doc ?? '')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
