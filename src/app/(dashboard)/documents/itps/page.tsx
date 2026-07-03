'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useItps } from '@/hooks/useItp'
import { useProjects } from '@/hooks/useProjects'
import { formatDate } from '@/lib/utils'
import {
  ITP_STATUS_LABELS,
  ITP_STATUS_COLORS,
  type ItpStatus,
} from '@/types'
import { Plus, ClipboardCheck, ChevronRight, Award } from 'lucide-react'

const DISCIPLINES = ['piping','mechanical','electrical','instrumentation','civil','structural','general']

export default function ItpsPage() {
  const { data: itps = [], isLoading } = useItps()
  const { data: projects = [] } = useProjects()
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState<ItpStatus | ''>('')

  const filtered = itps.filter(itp => {
    const matchProject = !filterProject || itp.project_id === filterProject
    const matchStatus = !filterStatus || itp.status === filterStatus
    return matchProject && matchStatus
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Inspection Test Plans</h1>
          <p className="text-surface-400 mt-1">Define what gets inspected, by whom, and at what level</p>
        </div>
        <Link href="/documents/itps/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New ITP
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as ItpStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(ITP_STATUS_LABELS) as ItpStatus[]).map(s => (
            <option key={s} value={s}>{ITP_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 h-24 animate-pulse bg-surface-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-surface-600 mx-auto mb-4" />
          <p className="text-surface-400 text-lg font-medium">No Inspection Test Plans yet.</p>
          <p className="text-surface-500 text-sm mt-2">Create your first ITP to define inspection requirements.</p>
          <Link href="/documents/itps/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New ITP
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(itp => {
            const items = itp.itp_items ?? []
            const complete = items.filter(i => i.status === 'complete').length
            const total = items.length
            const pct = total > 0 ? Math.round((complete / total) * 100) : 0

            const isComplete = !!itp.completed_at

            return (
              <Link key={itp.id} href={`/documents/itps/${itp.id}`}>
                <div className={`card p-4 hover:border-surface-600 transition-colors cursor-pointer ${isComplete ? 'border-green-500/30' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-sm font-bold text-brand-400">{itp.itp_number}</span>
                        {itp.revision && <span className="text-xs text-surface-500">Rev {itp.revision}</span>}
                        <span className={`badge text-xs ${ITP_STATUS_COLORS[itp.status]}`}>
                          {ITP_STATUS_LABELS[itp.status]}
                        </span>
                        {isComplete && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                            ✓ Complete
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-surface-100">{itp.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 flex-wrap">
                        {itp.project && <span>{itp.project.name}</span>}
                        <span className="capitalize">{itp.discipline}</span>
                        {itp.approved_by && (
                          <span>Approved by {itp.approved_by}
                            {itp.approved_date ? ` · ${formatDate(itp.approved_date)}` : ''}
                          </span>
                        )}
                        <span>{total} activities</span>
                        {total > 0 && <span>{pct}% complete</span>}
                        {isComplete && (
                          <span className="text-green-400">
                            Completed {formatDate(itp.completed_at!)}
                          </span>
                        )}
                      </div>
                      {total > 0 && (
                        <div className="mt-2 h-1.5 bg-surface-800 rounded-full overflow-hidden w-48">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isComplete && (
                        <a
                          href={`/api/reports/itp-certificate?id=${itp.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Certificate PDF
                        </a>
                      )}
                      <ChevronRight className="w-5 h-5 text-surface-600" />
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
