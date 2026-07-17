'use client'
// ============================================================
// Material Trace — Batch recall search
// Find every weld that used a given heat number or filler batch
// ============================================================
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import { cn } from '@/lib/utils'
import {
  Search,
  Fingerprint,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────
interface RecallWeld {
  weld_id:       string
  weld_id_number: string
  project_id:    string
  project_name:  string
  spool_id:      string | null
  spool_number:  string | null
  weld_status:   string
  heat_role:     string
  welder_stamp:  string | null
  weld_date:     string | null
}

interface RecallMtr {
  id:            string
  heat_number:   string
  material_spec: string
  material_type: string
  status:        string
  supplier:      string | null
}

interface RecallResult {
  query:      string
  welds:      RecallWeld[]
  totalWelds: number
  mtrs:       RecallMtr[]
  severity:   'critical' | 'info' | 'not_found'
}

// ── Status badge config ────────────────────────────────────────
const MTR_STATUS: Record<string, { label: string; color: string }> = {
  received:   { label: 'Received',   color: 'bg-surface-700 text-surface-300' },
  accepted:   { label: 'Accepted',   color: 'bg-green-500/15 text-green-300'  },
  rejected:   { label: 'Rejected',   color: 'bg-red-500/15 text-red-300'      },
  quarantine: { label: 'Quarantine', color: 'bg-amber-500/15 text-amber-300'  },
  consumed:   { label: 'Consumed',   color: 'bg-surface-700 text-surface-400' },
}

const WELD_STATUS: Record<string, string> = {
  not_welded: 'bg-surface-700 text-surface-400',
  welded:     'bg-blue-500/15 text-blue-300',
  accepted:   'bg-green-500/15 text-green-300',
  failed:     'bg-red-500/15 text-red-300',
  repaired:   'bg-orange-500/15 text-orange-300',
}

const HEAT_ROLE_LABEL: Record<string, string> = {
  base_metal_a: 'Base Metal A',
  base_metal_b: 'Base Metal B',
  filler_batch: 'Filler Batch',
}

// ── Skeleton row ──────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1,2,3,4,5].map(i => (
        <tr key={i} className="border-b border-surface-800 animate-pulse">
          {[1,2,3,4,5,6,7].map(j => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-surface-800 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function MaterialTracePage() {
  const [inputValue, setInputValue] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const { data, isLoading, isFetching } = useQuery<RecallResult>({
    queryKey: ['material-trace', activeQuery],
    enabled:  activeQuery.length >= 2,
    staleTime: 30_000,
    queryFn:  async () => {
      const res = await apiFetch(`/api/material-trace?q=${encodeURIComponent(activeQuery)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? 'Request failed')
      }
      return res.json()
    },
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (trimmed.length >= 2) setActiveQuery(trimmed)
  }

  // Group welds by project
  const weldsByProject: Record<string, RecallWeld[]> = {}
  for (const w of data?.welds ?? []) {
    if (!weldsByProject[w.project_name]) weldsByProject[w.project_name] = []
    weldsByProject[w.project_name].push(w)
  }
  const projectNames = Object.keys(weldsByProject).sort()

  const fetching = isLoading || isFetching

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Fingerprint className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Material Trace</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Batch recall — find every weld that used a heat number or filler batch
          </p>
        </div>
      </div>

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} className="card p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              className="input pl-9 font-mono uppercase tracking-wide"
              placeholder="Enter heat number or filler batch lot (e.g. A1234B)"
              value={inputValue}
              onChange={e => setInputValue(e.target.value.toUpperCase())}
              minLength={2}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={inputValue.trim().length < 2 || fetching}
            className="btn-primary px-6 flex items-center gap-2"
          >
            {fetching
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Search className="w-4 h-4" />
            }
            Search
          </button>
        </div>
        {activeQuery && (
          <p className="text-xs text-surface-600 mt-2">
            Searching for: <span className="font-mono text-surface-400">{activeQuery}</span>
          </p>
        )}
      </form>

      {/* ── Severity banner ── */}
      {data?.severity === 'critical' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              Rejected / quarantined material detected — {data.totalWelds} weld{data.totalWelds !== 1 ? 's' : ''} affected
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Immediately review affected welds and escalate to QA/QC per your quarantine procedure.
            </p>
          </div>
        </div>
      )}

      {/* ── MTR cards ── */}
      {(data?.mtrs ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wide mb-3">
            MTR Records — {data!.query}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data!.mtrs.map(mtr => {
              const cfg = MTR_STATUS[mtr.status] ?? MTR_STATUS.received
              return (
                <div key={mtr.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-mono font-bold text-surface-100 text-sm">{mtr.heat_number}</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-surface-400">{mtr.material_spec}</p>
                  <p className="text-xs text-surface-600 capitalize mt-0.5">{mtr.material_type}</p>
                  {mtr.supplier && (
                    <p className="text-xs text-surface-600 mt-1">Supplier: {mtr.supplier}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Welds table ── */}
      {activeQuery && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-800 flex items-center justify-between">
            <span className="text-sm font-medium text-surface-300">
              Affected Welds
            </span>
            {data && (
              <span className="text-xs text-surface-500">
                {data.totalWelds} weld{data.totalWelds !== 1 ? 's' : ''} found
              </span>
            )}
          </div>

          {fetching ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-900/50">
                    {['Weld ID', 'Project', 'Spool', 'Status', 'Role', 'Welder', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  <SkeletonRows />
                </tbody>
              </table>
            </div>
          ) : data?.totalWelds === 0 ? (
            <div className="p-14 text-center">
              <ShieldCheck className="w-10 h-10 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 font-medium">No welds found</p>
              <p className="text-surface-600 text-sm mt-1">
                No welds in your organization reference <span className="font-mono">{data?.query}</span>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-900/50">
                    {['Weld ID', 'Project', 'Spool', 'Status', 'Role', 'Welder', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {projectNames.map(projectName => (
                    weldsByProject[projectName].map((w, idx) => (
                      <tr key={w.weld_id} className="hover:bg-surface-800/30 transition-colors group">
                        <td className="px-4 py-3">
                          <Link
                            href={`/welds/${w.weld_id}`}
                            className="font-mono text-brand-300 hover:text-brand-200 font-semibold"
                          >
                            {w.weld_id_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-surface-400 text-xs max-w-[140px] truncate">
                          {idx === 0 ? (
                            <span className="font-medium text-surface-300">{projectName}</span>
                          ) : (
                            <span className="text-surface-700">↳</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-surface-400">
                          {w.spool_number ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            WELD_STATUS[w.weld_status] ?? 'bg-surface-700 text-surface-400'
                          )}>
                            {w.weld_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-surface-500">
                            {HEAT_ROLE_LABEL[w.heat_role] ?? w.heat_role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-surface-400">
                          {w.welder_stamp ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
                          {w.weld_date
                            ? new Date(w.weld_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/welds/${w.weld_id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-600 hover:text-brand-400"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── No query yet — empty state ── */}
      {!activeQuery && (
        <div className="card p-14 text-center">
          <ShieldCheck className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium">Enter a heat number or batch lot to begin</p>
          <p className="text-surface-600 text-sm mt-1">
            Search across base metal heat A, base metal heat B, and filler batch numbers
          </p>
        </div>
      )}

    </div>
  )
}
