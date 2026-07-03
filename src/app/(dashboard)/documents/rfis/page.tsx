'use client'
// ============================================================
// RFIs — Request for Information Log
// ============================================================
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, MessageSquareMore, Calendar } from 'lucide-react'
import { differenceInCalendarDays, isAfter, startOfDay } from 'date-fns'
import { useRfis } from '@/hooks/useRfi'
import { useProjects } from '@/hooks/useProjects'
import {
  RFI_STATUS_LABELS,
  RFI_STATUS_COLORS,
  RFI_PRIORITY_COLORS,
  type RfiStatus,
  type RfiPriority,
} from '@/types'
import { cn } from '@/lib/utils'

const TODAY = startOfDay(new Date())

function isOverdue(rfi: { required_by_date: string | null; status: RfiStatus }): boolean {
  if (!rfi.required_by_date) return false
  if (rfi.status === 'answered' || rfi.status === 'closed' || rfi.status === 'void') return false
  return isAfter(TODAY, startOfDay(new Date(rfi.required_by_date)))
}

export default function RfisPage() {
  const { data: rfis = [], isLoading } = useRfis()
  const { data: projects = [] } = useProjects()

  const [filterProject,  setFilterProject]  = useState('')
  const [filterStatus,   setFilterStatus]   = useState<RfiStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<RfiPriority | ''>('')
  const [search, setSearch] = useState('')

  // Stats
  const totalAll  = rfis.length
  const totalOpen = rfis.filter(r => ['draft','submitted','under_review'].includes(r.status)).length
  const answered  = rfis.filter(r => r.status === 'answered').length
  const overdue   = rfis.filter(r => isOverdue(r)).length

  const filtered = useMemo(() => {
    return rfis.filter(r => {
      if (filterProject  && r.project_id !== filterProject)   return false
      if (filterStatus   && r.status     !== filterStatus)    return false
      if (filterPriority && r.priority   !== filterPriority)  return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.rfi_number.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.question.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rfis, filterProject, filterStatus, filterPriority, search])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">RFIs</h1>
          <p className="text-sm text-surface-500 mt-0.5">Request for Information log</p>
        </div>
        <Link href="/documents/rfis/new" className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> New RFI
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-surface-200 mt-1">{totalAll}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Open</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{totalOpen}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Answered</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{answered}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Overdue</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input max-w-[180px]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value as RfiStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(RFI_STATUS_LABELS) as RfiStatus[]).map(s => (
            <option key={s} value={s}>{RFI_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className="input max-w-[140px]" value={filterPriority} onChange={e => setFilterPriority(e.target.value as RfiPriority | '')}>
          <option value="">All Priorities</option>
          {(['low','normal','high','urgent'] as RfiPriority[]).map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <input
          className="input flex-1 min-w-[180px]"
          placeholder="Search title, number, question…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquareMore className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">
            No RFIs yet. Create your first RFI to track design questions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rfi => {
            const daysOpen = differenceInCalendarDays(new Date(), new Date(rfi.created_at))
            const overdueFlag = isOverdue(rfi)
            return (
              <Link
                key={rfi.id}
                href={`/documents/rfis/${rfi.id}`}
                className="card p-4 block hover:border-surface-600 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-surface-200 text-sm">{rfi.rfi_number}</span>
                      <span className={cn('badge text-xs px-2 py-0.5 rounded', RFI_PRIORITY_COLORS[rfi.priority])}>
                        {rfi.priority}
                      </span>
                      <span className={cn('badge text-xs px-2 py-0.5 rounded', RFI_STATUS_COLORS[rfi.status])}>
                        {RFI_STATUS_LABELS[rfi.status]}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="font-semibold text-surface-100 mt-1">{rfi.title}</p>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-surface-500">
                      {rfi.project && (
                        <span>{rfi.project.project_number} — {rfi.project.name}</span>
                      )}
                      <span className="bg-surface-700 text-surface-400 px-2 py-0.5 rounded">{rfi.discipline}</span>
                      {rfi.submitted_to && (
                        <span>To: {rfi.submitted_to}</span>
                      )}
                      {rfi.required_by_date && (
                        <span className={cn('flex items-center gap-1', overdueFlag ? 'text-red-400 font-medium' : '')}>
                          <Calendar className="w-3 h-3" />
                          Need by {rfi.required_by_date}
                          {overdueFlag && ' — OVERDUE'}
                        </span>
                      )}
                      <span className="text-surface-600">{daysOpen}d open</span>
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
