'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { downloadCSV, todayISO } from '@/lib/reports/csv-export'

interface WelderRow {
  stamp:    string
  name:     string
  total:    number
  accepted: number
  failed:   number
  repaired: number
  pending:  number
  rate:     number
}

function rateColor(r: number) {
  if (r >= 97) return 'text-emerald-400'
  if (r >= 95) return 'text-green-400'
  if (r >= 90) return 'text-yellow-400'
  return 'text-red-400'
}

function rateLabel(r: number) {
  if (r >= 97) return 'Excellent'
  if (r >= 95) return 'Good'
  if (r >= 90) return 'Fair'
  return 'Review'
}

export default function WelderPerformancePage() {
  const { profile }        = useAuth()
  const { data: projects } = useProjects()

  const [rows,       setRows]        = useState<WelderRow[]>([])
  const [hasRun,     setHasRun]      = useState(false)
  const [isPending,  startTransition] = useTransition()

  const [projectId, setProjectId] = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  async function runReport() {
    if (!profile?.organization_id) return

    startTransition(async () => {
      const supabase = createClient()

      let query = supabase
        .from('welds')
        .select('welder_stamp, welder_name, status')
        .eq('organization_id', profile.organization_id)
        .not('welder_stamp', 'is', null)

      if (projectId) query = query.eq('project_id', projectId)
      if (dateFrom)  query = query.gte('weld_date', dateFrom)
      if (dateTo)    query = query.lte('weld_date', dateTo)

      const { data } = await query

      // Aggregate by stamp
      const map = new Map<string, WelderRow>()
      for (const w of data ?? []) {
        const key = w.welder_stamp!
        if (!map.has(key)) {
          map.set(key, { stamp: key, name: w.welder_name ?? '—', total: 0, accepted: 0, failed: 0, repaired: 0, pending: 0, rate: 0 })
        }
        const entry = map.get(key)!
        entry.total++
        if (w.status === 'accepted')    entry.accepted++
        if (w.status === 'failed')      entry.failed++
        if (w.status === 'repaired')    entry.repaired++
        if (w.status === 'xray_pending') entry.pending++
      }

      const result = Array.from(map.values())
        .map(r => ({ ...r, rate: r.total > 0 ? Math.round((r.accepted / r.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total)

      setRows(result)
      setHasRun(true)
    })
  }

  function handleExportCSV() {
    const csvRows = rows.map(r => ({
      'Stamp':        r.stamp,
      'Name':         r.name,
      'Total Welds':  r.total,
      'Accepted':     r.accepted,
      'Failed':       r.failed,
      'Repaired':     r.repaired,
      'X-Ray Pending': r.pending,
      'Pass Rate %':  r.rate,
      'Rating':       rateLabel(r.rate),
    }))
    downloadCSV(csvRows, `welder-performance-${todayISO()}.csv`)
  }

  const totalWelds    = rows.reduce((s, r) => s + r.total,    0)
  const totalAccepted = rows.reduce((s, r) => s + r.accepted, 0)
  const totalFailed   = rows.reduce((s, r) => s + r.failed,   0)
  const overallRate   = totalWelds > 0 ? Math.round((totalAccepted / totalWelds) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Welder Performance</h1>
            <p className="text-sm text-surface-500 mt-0.5">Pass rates and weld counts by welder stamp</p>
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
            <label className="label">Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
          </div>
        </div>
        <button onClick={runReport} disabled={isPending} className="btn-primary w-full py-2.5">
          {isPending ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">Welder Performance Report</h1>
        <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleString()}</p>
      </div>

      {!hasRun && (
        <div className="text-center py-20 text-surface-600 print:hidden">
          Set your filters above and click <strong className="text-surface-400">Run Report</strong>
        </div>
      )}

      {hasRun && rows.length === 0 && (
        <div className="text-center py-20 card print:hidden">
          <p className="text-surface-500">No welds found with the selected filters.</p>
        </div>
      )}

      {hasRun && rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
            {[
              { label: 'Welders',       value: rows.length,   color: 'text-surface-200' },
              { label: 'Total Welds',   value: totalWelds,    color: 'text-surface-200' },
              { label: 'Overall Pass',  value: `${overallRate}%`, color: rateColor(overallRate) },
              { label: 'Total Failed',  value: totalFailed,   color: totalFailed > 0 ? 'text-red-400' : 'text-surface-200' },
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
                    {['Stamp', 'Name', 'Total', 'Accepted', 'Failed', 'Repaired', 'X-Ray Pend.', 'Pass Rate', 'Rating'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/60 print:divide-gray-200">
                  {rows.map(row => (
                    <tr key={row.stamp} className="hover:bg-surface-800/40 transition-colors print:hover:bg-transparent">
                      <td className="px-4 py-3 font-mono font-bold text-brand-300 print:text-black">{row.stamp}</td>
                      <td className="px-4 py-3 text-surface-300 print:text-black">{row.name}</td>
                      <td className="px-4 py-3 font-semibold text-surface-200 print:text-black">{row.total}</td>
                      <td className="px-4 py-3 text-green-400 print:text-black">{row.accepted}</td>
                      <td className="px-4 py-3 text-red-400 print:text-black">{row.failed}</td>
                      <td className="px-4 py-3 text-purple-400 print:text-black">{row.repaired}</td>
                      <td className="px-4 py-3 text-yellow-400 print:text-black">{row.pending}</td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                row.rate >= 95 ? 'bg-green-500' :
                                row.rate >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${row.rate}%` }}
                            />
                          </div>
                          <span className={`font-bold text-sm w-10 text-right flex-shrink-0 ${rateColor(row.rate)} print:text-black`}>
                            {row.rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full print:text-black ${
                          row.rate >= 97 ? 'bg-emerald-500/15 text-emerald-400' :
                          row.rate >= 95 ? 'bg-green-500/15 text-green-400' :
                          row.rate >= 90 ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>
                          {rateLabel(row.rate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Summary row */}
                  <tr className="border-t-2 border-surface-600 bg-surface-800/60 font-semibold">
                    <td className="px-4 py-3 text-surface-300 text-xs uppercase tracking-wide" colSpan={2}>Overall</td>
                    <td className="px-4 py-3 text-surface-200 print:text-black">{totalWelds}</td>
                    <td className="px-4 py-3 text-green-400 print:text-black">{totalAccepted}</td>
                    <td className="px-4 py-3 text-red-400 print:text-black">{totalFailed}</td>
                    <td className="px-4 py-3 text-surface-400 print:text-black">—</td>
                    <td className="px-4 py-3 text-surface-400 print:text-black">—</td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              overallRate >= 95 ? 'bg-green-500' :
                              overallRate >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${overallRate}%` }}
                          />
                        </div>
                        <span className={`font-bold text-sm w-10 text-right flex-shrink-0 ${rateColor(overallRate)} print:text-black`}>
                          {overallRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        overallRate >= 97 ? 'bg-emerald-500/15 text-emerald-400' :
                        overallRate >= 95 ? 'bg-green-500/15 text-green-400' :
                        overallRate >= 90 ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>{rateLabel(overallRate)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="hidden print:block px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
              PipeField OS · Welder Performance · {rows.length} welders · {totalWelds} total welds · {new Date().toLocaleDateString()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
