'use client'
// ============================================================
// NCRs — Non-Conformance Reports List
// ============================================================
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, AlertOctagon } from 'lucide-react'
import { isAfter, startOfDay } from 'date-fns'
import { useNcrs } from '@/hooks/useNcr'
import { useProjects } from '@/hooks/useProjects'
import {
  NCR_STATUS_LABELS,
  NCR_STATUS_COLORS,
  NCR_SEVERITY_COLORS,
  NCR_DISPOSITION_LABELS,
  type NcrStatus,
  type NcrSeverity,
  type NcrDisposition,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

const TODAY = startOfDay(new Date())

function isOverdue(ncr: { due_date: string | null; status: NcrStatus }): boolean {
  if (!ncr.due_date) return false
  if (ncr.status === 'closed' || ncr.status === 'void') return false
  return isAfter(TODAY, startOfDay(new Date(ncr.due_date)))
}

export default function NcrsPage() {
  const { data: ncrs = [], isLoading } = useNcrs()
  const { data: projects = [] } = useProjects()

  const [filterProject,  setFilterProject]  = useState('')
  const [filterSeverity, setFilterSeverity] = useState<NcrSeverity | ''>('')
  const [filterStatus,   setFilterStatus]   = useState<NcrStatus | ''>('')
  const [search,         setSearch]         = useState('')

  const totalOpen = ncrs.filter(n => !['closed','void'].includes(n.status)).length
  const critical  = ncrs.filter(n => n.severity === 'critical' && !['closed','void'].includes(n.status)).length
  const major     = ncrs.filter(n => n.severity === 'major' && !['closed','void'].includes(n.status)).length
  const closed    = ncrs.filter(n => n.status === 'closed').length

  const filtered = useMemo(() => {
    const base = ncrs.filter(n => {
      if (filterProject  && n.project_id !== filterProject)  return false
      if (filterSeverity && n.severity   !== filterSeverity) return false
      if (filterStatus   && n.status     !== filterStatus)   return false
      if (search) {
        const q = search.toLowerCase()
        return (
          n.ncr_number.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.raised_by.toLowerCase().includes(q)
        )
      }
      return true
    })

    // Group: critical first, then major, then minor
    const order: NcrSeverity[] = ['critical', 'major', 'minor']
    return [...base].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
  }, [ncrs, filterProject, filterSeverity, filterStatus, search])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertOctagon className="w-5 h-5 text-red-400" />
            <h1 className="text-2xl font-bold text-surface-50">NCRs</h1>
          </div>
          <p className="text-surface-400 text-sm">Non-Conformance Reports</p>
        </div>
        <Link href="/documents/ncrs/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Raise NCR
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Total Open</p>
          <p className="text-2xl font-bold text-red-400">{totalOpen}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Critical</p>
          <p className="text-2xl font-bold text-red-300">{critical}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Major</p>
          <p className="text-2xl font-bold text-orange-300">{major}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Closed</p>
          <p className="text-2xl font-bold text-green-400">{closed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input text-sm py-1.5 px-3" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="input text-sm py-1.5 px-3" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as NcrSeverity | '')}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
        <select className="input text-sm py-1.5 px-3" value={filterStatus} onChange={e => setFilterStatus(e.target.value as NcrStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(NCR_STATUS_LABELS) as NcrStatus[]).map(k => (
            <option key={k} value={k}>{NCR_STATUS_LABELS[k]}</option>
          ))}
        </select>
        <input
          type="text"
          className="input text-sm py-1.5 px-3 flex-1 min-w-[200px]"
          placeholder="Search NCR number, title, raised by…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-surface-500 text-sm py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertOctagon className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400">No NCRs found.</p>
          <Link href="/documents/ncrs/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Raise NCR
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ncr => {
            const overdue = isOverdue(ncr)
            return (
              <Link
                key={ncr.id}
                href={`/documents/ncrs/${ncr.id}`}
                className="card p-4 block hover:border-surface-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-surface-50">{ncr.ncr_number}</span>
                      <span className={cn('badge text-xs', NCR_SEVERITY_COLORS[ncr.severity])}>
                        {ncr.severity.charAt(0).toUpperCase() + ncr.severity.slice(1)}
                      </span>
                      <span className={cn('badge text-xs', NCR_STATUS_COLORS[ncr.status])}>
                        {NCR_STATUS_LABELS[ncr.status]}
                      </span>
                    </div>
                    <p className="font-semibold text-surface-100 truncate max-w-lg">{ncr.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {ncr.project && (
                        <span className="text-sm text-surface-400">{ncr.project.name}</span>
                      )}
                      <span className="badge bg-surface-700 text-surface-300 text-xs">{ncr.discipline}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 flex-wrap">
                      <span>Raised by {ncr.raised_by}</span>
                      <span>{formatDate(ncr.raised_date)}</span>
                      {ncr.due_date && (
                        <span className={cn(overdue && 'text-red-400 font-medium')}>
                          Due: {formatDate(ncr.due_date)}{overdue ? ' (Overdue)' : ''}
                        </span>
                      )}
                      {ncr.disposition && (
                        <span className="badge bg-surface-700 text-surface-300 text-xs">
                          {NCR_DISPOSITION_LABELS[ncr.disposition as NcrDisposition]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
