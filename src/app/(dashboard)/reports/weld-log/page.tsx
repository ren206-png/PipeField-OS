'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Loader2, Printer, Search, X, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { WeldStatusBadge } from '@/components/welds/WeldStatusBadge'
import { downloadCSV, todayISO } from '@/lib/reports/csv-export'
import { WELD_STATUS_LABELS, type WeldStatus } from '@/types'
import { formatDate } from '@/lib/utils'

const ALL_STATUSES = Object.keys(WELD_STATUS_LABELS) as WeldStatus[]

interface WeldRow {
  id:             string
  weld_id_number: string
  status:         string
  welder_stamp:   string | null
  welder_name:    string | null
  weld_date:      string | null
  spool_number:   string | null
  line_number:    string | null
  pipe_size:      string | null
  weld_process:   string | null
  material:       string | null
  notes:          string | null
  project_name:   string
}

export default function WeldLogReportPage() {
  const { profile }         = useAuth()
  const { data: projects }  = useProjects()

  const [rows,        setRows]        = useState<WeldRow[]>([])
  const [hasRun,      setHasRun]      = useState(false)
  const [isPending,   startTransition] = useTransition()
  const [pdfLoading,  setPdfLoading]  = useState(false)

  // Filters
  const [projectId,  setProjectId]  = useState('')
  const [status,     setStatus]     = useState<WeldStatus | ''>('')
  const [welderStamp,setWelderStamp] = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [search,     setSearch]     = useState('')

  async function runReport() {
    if (!profile?.organization_id) return

    startTransition(async () => {
      const supabase = createClient()

      let query = supabase
        .from('welds')
        .select('*, projects(name)')
        .eq('organization_id', profile.organization_id)
        .order('weld_date',    { ascending: false })
        .order('created_at',   { ascending: false })

      if (projectId)   query = query.eq('project_id',   projectId)
      if (status)      query = query.eq('status',        status)
      if (welderStamp) query = query.ilike('welder_stamp', `%${welderStamp}%`)
      if (dateFrom)    query = query.gte('weld_date',   dateFrom)
      if (dateTo)      query = query.lte('weld_date',   dateTo)
      if (search)      query = query.or(
        `weld_id_number.ilike.%${search}%,welder_name.ilike.%${search}%,spool_number.ilike.%${search}%`
      )

      const { data } = await query

      const mapped: WeldRow[] = (data ?? []).map((w: any) => ({
        id:             w.id,
        weld_id_number: w.weld_id_number,
        status:         w.status,
        welder_stamp:   w.welder_stamp,
        welder_name:    w.welder_name,
        weld_date:      w.weld_date,
        spool_number:   w.spool_number,
        line_number:    w.line_number,
        pipe_size:      w.pipe_size,
        weld_process:   w.weld_process,
        material:       w.material,
        notes:          w.notes,
        project_name:   w.projects?.name ?? '—',
      }))

      setRows(mapped)
      setHasRun(true)
    })
  }

  async function exportPDF() {
    setPdfLoading(true)
    try {
      const res = await fetch('/api/reports/weld-log-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, status, welderStamp, dateFrom, dateTo, search }),
      })
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `weld-log-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('PDF export failed')
    } finally {
      setPdfLoading(false)
    }
  }

  function handleExportCSV() {
    const csvRows = rows.map(r => ({
      'Weld ID':      r.weld_id_number,
      'Project':      r.project_name,
      'Status':       WELD_STATUS_LABELS[r.status as WeldStatus] ?? r.status,
      'Welder Stamp': r.welder_stamp ?? '',
      'Welder Name':  r.welder_name  ?? '',
      'Weld Date':    r.weld_date    ?? '',
      'Spool #':      r.spool_number ?? '',
      'Line #':       r.line_number  ?? '',
      'Pipe Size':    r.pipe_size    ?? '',
      'Process':      r.weld_process ?? '',
      'Material':     r.material     ?? '',
      'Notes':        r.notes        ?? '',
    }))
    downloadCSV(csvRows, `weld-log-${todayISO()}.csv`)
  }

  const hasFilters = !!(projectId || status || welderStamp || dateFrom || dateTo || search)

  function clearFilters() {
    setProjectId('')
    setStatus('')
    setWelderStamp('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Weld Log</h1>
            <p className="text-sm text-surface-500 mt-0.5">Filter and export your complete weld record</p>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={pdfLoading || rows.length === 0}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {pdfLoading ? 'Generating…' : 'Export PDF'}
            </button>
            {projectId && (
              <button
                onClick={() => window.open('/api/reports/qa-package?projectId=' + projectId, '_blank')}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Download QA Package (PDF)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="card p-5 space-y-4 print:hidden">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-surface-500" />
          <h2 className="text-sm font-semibold text-surface-300">Filters</h2>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
              <option value="">All projects</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as WeldStatus | '')} className="input">
              <option value="">All statuses</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{WELD_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Welder Stamp</label>
            <input
              value={welderStamp}
              onChange={e => setWelderStamp(e.target.value)}
              className="input font-mono uppercase"
              placeholder="e.g. AB1"
            />
          </div>
          <div>
            <label className="label">Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-8"
                placeholder="Weld ID, spool, welder…"
              />
            </div>
          </div>
        </div>

        <button
          onClick={runReport}
          disabled={isPending}
          className="btn-primary w-full py-2.5"
        >
          {isPending ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {/* ── Print header (only shows when printing) ── */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">Weld Log Report</h1>
        <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleString()}</p>
        {projectId && projects && (
          <p className="text-sm text-gray-600">Project: {projects.find(p => p.id === projectId)?.name}</p>
        )}
        {status && <p className="text-sm text-gray-600">Status: {WELD_STATUS_LABELS[status as WeldStatus]}</p>}
        {dateFrom && <p className="text-sm text-gray-600">Date range: {dateFrom} — {dateTo || 'present'}</p>}
      </div>

      {/* ── Results ── */}
      {!hasRun && (
        <div className="text-center py-20 text-surface-600 print:hidden">
          Set your filters above and click <strong className="text-surface-400">Run Report</strong>
        </div>
      )}

      {hasRun && rows.length === 0 && (
        <div className="text-center py-20 card print:hidden">
          <p className="text-surface-500">No welds match your filters.</p>
        </div>
      )}

      {hasRun && rows.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between text-sm print:hidden">
            <span className="text-surface-500">
              <span className="font-semibold text-surface-200">{rows.length}</span> welds found
            </span>
            <span className="text-surface-600">
              {rows.filter(r => r.status === 'accepted').length} accepted ·{' '}
              {rows.filter(r => r.status === 'failed').length} failed
            </span>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-800/50 print:bg-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Weld ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Stamp</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Welder</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden sm:table-cell">Spool</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Size</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Process</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/60 print:divide-gray-200">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-surface-800/40 transition-colors print:hover:bg-transparent">
                      <td className="px-4 py-3 font-mono font-semibold text-brand-300 print:text-black">
                        {row.weld_id_number}
                      </td>
                      <td className="px-4 py-3 text-surface-300 print:text-black max-w-[140px] truncate">
                        {row.project_name}
                      </td>
                      <td className="px-4 py-3 print:text-black">
                        <span className="print:hidden">
                          <WeldStatusBadge status={row.status as WeldStatus} size="sm" />
                        </span>
                        <span className="hidden print:inline">
                          {WELD_STATUS_LABELS[row.status as WeldStatus] ?? row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-brand-300 print:text-black">
                        {row.welder_stamp ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-300 print:text-black">
                        {row.welder_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 print:text-black">
                        {row.weld_date ? formatDate(row.weld_date) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-400 print:text-black hidden sm:table-cell">
                        {row.spool_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 print:text-black hidden lg:table-cell">
                        {row.pipe_size ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 print:text-black hidden lg:table-cell">
                        {row.weld_process ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print footer */}
            <div className="hidden print:block px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
              PipeField OS · Weld Log · {rows.length} records · {new Date().toLocaleDateString()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
