'use client'
// ============================================================
// Daily Field Reports — List Page
// ============================================================
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, ClipboardList, ChevronRight } from 'lucide-react'
import { useDfrs } from '@/hooks/useDfr'
import { useProjects } from '@/hooks/useProjects'
import { DFR_STATUS_COLORS, DFR_STATUS_LABELS, DFR_WEATHER_LABELS, type DfrStatus } from '@/types'

export default function DailyReportsPage() {
  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const { data: reports = [], isLoading } = useDfrs(projectId)
  const { data: projects = [] } = useProjects()

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Daily Field Reports</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Track daily site progress, crew, and conditions
          </p>
        </div>
        <Link href="/daily-reports/new" className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          New Report
        </Link>
      </div>

      {/* Project filter */}
      <div className="flex items-center gap-3">
        <label className="label text-sm whitespace-nowrap">Filter by Project:</label>
        <select
          className="input max-w-xs"
          value={projectId ?? ''}
          onChange={e => setProjectId(e.target.value || undefined)}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-7 h-7 text-brand-400" />
          </div>
          <p className="text-surface-400 text-sm">
            No daily reports yet. Create your first report to start tracking field progress.
          </p>
          <Link href="/daily-reports/new" className="btn-primary mt-4 inline-flex">
            Create First Report
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <Link
              key={report.id}
              href={`/daily-reports/${report.id}`}
              className="card p-4 flex items-center gap-4 hover:border-surface-600 transition-all duration-150 group"
            >
              {/* Left: number + date */}
              <div className="flex-shrink-0 w-36">
                <p className="text-sm font-mono font-bold text-brand-300">{report.report_number}</p>
                <p className="text-xs text-surface-500 mt-0.5">{report.report_date}</p>
              </div>

              {/* Center: project + supervisor */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-100 truncate">
                  {report.project?.name ?? '—'}
                </p>
                {report.supervisor_name && (
                  <p className="text-xs text-surface-500 mt-0.5 truncate">{report.supervisor_name}</p>
                )}
              </div>

              {/* Crew */}
              <div className="flex items-center gap-1.5 text-xs text-surface-400 flex-shrink-0">
                <Users className="w-3.5 h-3.5" />
                {report.crew_size}
              </div>

              {/* Weather */}
              {report.weather && (
                <span className="text-xs text-surface-400 flex-shrink-0 hidden sm:block">
                  {DFR_WEATHER_LABELS[report.weather]?.split(' ')[0]}
                </span>
              )}

              {/* Welds */}
              {report.welds_completed > 0 && (
                <span className="text-xs text-surface-400 flex-shrink-0 hidden md:block">
                  {report.welds_completed} welds
                </span>
              )}

              {/* Status badge */}
              <span className={`badge text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${DFR_STATUS_COLORS[report.status as DfrStatus]}`}>
                {DFR_STATUS_LABELS[report.status as DfrStatus]}
              </span>

              <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
