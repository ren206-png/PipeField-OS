'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { SpoolStatusBadge } from '@/components/spools/SpoolStatusBadge'
import { downloadCSV, todayISO } from '@/lib/reports/csv-export'
import { SPOOL_STATUS_LABELS, type SpoolStatus } from '@/types'
import { formatDate } from '@/lib/utils'

const ALL_STATUSES = Object.keys(SPOOL_STATUS_LABELS) as SpoolStatus[]

interface SpoolRow {
  id:            string
  spool_number:  string
  revision:      string | null
  status:        string
  project_name:  string
  pipe_size:     string | null
  material:      string | null
  area:          string | null
  isometric_ref: string | null
  priority:      number
  required_date: string | null
  released_date: string | null
  total_welds:   number
}

function priorityBadge(p: number) {
  if (p <= 2) return <span className="text-xs font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">P{p} Urgent</span>
  if (p <= 4) return <span className="text-xs font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded">P{p}</span>
  return <span className="text-xs text-surface-500">P{p}</span>
}

export default function SpoolStatusReportPage() {
  const { profile }        = useAuth()
  const { data: projects } = useProjects()

  const [rows,      setRows]         = useState<SpoolRow[]>([])
  const [hasRun,    setHasRun]       = useState(false)
  const [isPending, startTransition] = useTransition()

  const [projectId, setProjectId] = useState('')
  const [status,    setStatus]    = useState<SpoolStatus | ''>('')
  const [priority,  setPriority]  = useState('')

  async function runReport() {
    if (!profile?.organization_id) return

    startTransition(async () => {
      const supabase = createClient()

      let query = supabase
        .from('spools')
        .select('*, projects(name)')
        .eq('organization_id', profile.organization_id)
        .order('priority',     { ascending: true })
        .order('spool_number', { ascending: true })

      if (projectId) query = query.eq('project_id', projectId)
      if (status)    query = query.eq('status',     status)
      if (priority)  query = query.lte('priority',  parseInt(priority))

      const { data } = await query

      const mapped: SpoolRow[] = (data ?? []).map((s: any) => ({
        id:            s.id,
        spool_number:  s.spool_number,
        revision:      s.revision,
        status:        s.status,
        project_name:  s.projects?.name ?? '—',
        pipe_size:     s.pipe_size,
        material:      s.material,
        area:          s.area,
        isometric_ref: s.isometric_ref,
        priority:      s.priority ?? 5,
        required_date: s.required_date,
        released_date: s.released_date,
        total_welds:   s.total_welds ?? 0,
      }))

      setRows(mapped)
      setHasRun(true)
    })
  }

  function handleExportCSV() {
    const csvRows = rows.map(r => ({
      'Spool #':      r.spool_number,
      'Rev':          r.revision ?? 'A',
      'Project':      r.project_name,
      'Status':       SPOOL_STATUS_LABELS[r.status as SpoolStatus] ?? r.status,
      'Priority':     r.priority,
      'Pipe Size':    r.pipe_size    ?? '',
      'Material':     r.material     ?? '',
      'Area':         r.area         ?? '',
      'ISO Ref':      r.isometric_ref ?? '',
      'Required By':  r.required_date ?? '',
      'Released':     r.released_date ?? '',
      'Weld Count':   r.total_welds,
    }))
    downloadCSV(csvRows, `spool-status-${todayISO()}.csv`)
  }

  const released    = rows.filter(r => r.status === 'released').length
  const urgentCount = rows.filter(r => r.priority <= 2 && r.status !== 'released').length

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Spool Status</h1>
            <p className="text-sm text-surface-500 mt-0.5">Fabrication pipeline snapshot</p>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="btn-ghost flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button onClick={handleExportCSV} className="btn-primary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="card p-5 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
              <option value="">All projects</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as SpoolStatus | '')} className="input">
              <option value="">All statuses</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{SPOOL_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Max Priority (1 = urgent only)</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="input">
              <option value="">All priorities</option>
              {[1,2,3,4,5].map(n => (
                <option key={n} value={String(n)}>P{n} and above</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={runReport} disabled={isPending} className="btn-primary w-full py-2.5">
          {isPending ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">Spool Status Report</h1>
        <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleString()}</p>
      </div>

      {!hasRun && (
        <div className="text-center py-20 text-surface-600 print:hidden">
          Set your filters above and click <strong className="text-surface-400">Run Report</strong>
        </div>
      )}

      {hasRun && rows.length === 0 && (
        <div className="text-center py-20 card print:hidden">
          <p className="text-surface-500">No spools match your filters.</p>
        </div>
      )}

      {hasRun && rows.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
            {[
              { label: 'Total Spools', value: rows.length,    color: 'text-surface-200' },
              { label: 'Released',     value: released,       color: 'text-emerald-400' },
              { label: 'Urgent',       value: urgentCount,    color: urgentCount > 0 ? 'text-red-400' : 'text-surface-200' },
              { label: 'In Progress',  value: rows.length - released, color: 'text-brand-400' },
            ].map(c => (
              <div key={c.label} className="card p-4 text-center">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-surface-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-800/50 print:bg-gray-100">
                    {['Spool #', 'Rev', 'Project', 'Status', 'Priority', 'Size', 'Area', 'Required By', 'Welds'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/60 print:divide-gray-200">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-surface-800/40 transition-colors print:hover:bg-transparent">
                      <td className="px-4 py-3 font-mono font-bold text-surface-100 print:text-black">{row.spool_number}</td>
                      <td className="px-4 py-3 font-mono text-surface-500 print:text-black">{row.revision ?? 'A'}</td>
                      <td className="px-4 py-3 text-surface-300 print:text-black max-w-[120px] truncate">{row.project_name}</td>
                      <td className="px-4 py-3 print:text-black">
                        <span className="print:hidden">
                          <SpoolStatusBadge status={row.status as SpoolStatus} size="sm" />
                        </span>
                        <span className="hidden print:inline">
                          {SPOOL_STATUS_LABELS[row.status as SpoolStatus] ?? row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 print:text-black">
                        <span className="print:hidden">{priorityBadge(row.priority)}</span>
                        <span className="hidden print:inline">P{row.priority}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-400 print:text-black">{row.pipe_size ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400 print:text-black">{row.area ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400 print:text-black">
                        {row.required_date ? formatDate(row.required_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 print:text-black text-center">{row.total_welds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hidden print:block px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
              PipeField OS · Spool Status · {rows.length} spools · {new Date().toLocaleDateString()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
