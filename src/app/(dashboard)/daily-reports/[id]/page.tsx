'use client'
// ============================================================
// Daily Field Report — Detail / View Page
// ============================================================
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit3, Users, Flame, Package } from 'lucide-react'
import { useDfr, useUpdateDfr } from '@/hooks/useDfr'
import { useAuth } from '@/hooks/useAuth'
import {
  DFR_STATUS_COLORS, DFR_STATUS_LABELS, DFR_WEATHER_LABELS,
  type DfrStatus,
} from '@/types'
import { formatDateTime } from '@/lib/utils'

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs text-surface-500 mb-0.5">{label}</p>
      <p className="text-sm text-surface-200">{value}</p>
    </div>
  )
}

export default function DfrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: report, isLoading } = useDfr(id)
  const { isOrgAdmin } = useAuth()
  const updateDfr = useUpdateDfr()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-16">
        <p className="text-surface-400">Report not found.</p>
        <Link href="/daily-reports" className="btn-primary mt-4 inline-flex">Back to Reports</Link>
      </div>
    )
  }

  async function handleSubmit() {
    await updateDfr.mutateAsync({ id, status: 'submitted' })
  }

  async function handleApprove() {
    await updateDfr.mutateAsync({
      id,
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/daily-reports" className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono text-brand-300">{report.report_number}</h1>
            <span className={`badge text-xs px-2 py-0.5 rounded font-semibold ${DFR_STATUS_COLORS[report.status as DfrStatus]}`}>
              {DFR_STATUS_LABELS[report.status as DfrStatus]}
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-0.5">
            {report.report_date}
            {report.project && (
              <span className="ml-2 text-surface-500">— {report.project.name}</span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {report.status === 'draft' && (
            <button
              onClick={handleSubmit}
              disabled={updateDfr.isPending}
              className="btn-primary text-sm"
            >
              {updateDfr.isPending ? 'Saving…' : 'Submit Report'}
            </button>
          )}
          {report.status === 'submitted' && isOrgAdmin && (
            <button
              onClick={handleApprove}
              disabled={updateDfr.isPending}
              className="btn-primary text-sm bg-green-600 hover:bg-green-500"
            >
              {updateDfr.isPending ? 'Saving…' : 'Approve'}
            </button>
          )}
          {report.status === 'draft' && (
            <Link href={`/daily-reports/${id}/edit`} className="btn-ghost flex items-center gap-1.5 text-sm">
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Section 1 — Site Conditions */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">Site Conditions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoRow label="Weather" value={report.weather ? DFR_WEATHER_LABELS[report.weather] : null} />
          <InfoRow label="Temperature" value={report.temperature} />
          <InfoRow label="Supervisor" value={report.supervisor_name} />
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Crew Size</p>
            <p className="text-sm text-surface-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-surface-500" />
              {report.crew_size}
            </p>
          </div>
        </div>
        {report.work_areas && (
          <InfoRow label="Work Areas" value={report.work_areas} />
        )}
      </div>

      {/* Section 2 — Work Summary */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">Work Summary</h2>
        <div>
          <p className="text-xs text-surface-500 mb-1">Work Completed</p>
          <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{report.work_completed}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-surface-700/50 rounded-lg px-3 py-2">
            <Flame className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-bold text-surface-100">{report.welds_completed}</span>
            <span className="text-xs text-surface-500">welds</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-700/50 rounded-lg px-3 py-2">
            <Package className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-surface-100">{report.spools_completed}</span>
            <span className="text-xs text-surface-500">spools</span>
          </div>
        </div>
      </div>

      {/* Section 3 — Resources */}
      {(report.equipment_used || report.materials_used) && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">Resources</h2>
          <InfoRow label="Equipment Used" value={report.equipment_used} />
          <InfoRow label="Materials Used" value={report.materials_used} />
        </div>
      )}

      {/* Section 4 — Issues & Safety */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">Issues &amp; Safety</h2>
        {report.issues_delays ? (
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Issues / Delays</p>
            <p className="text-sm text-red-300 whitespace-pre-wrap">{report.issues_delays}</p>
          </div>
        ) : (
          <p className="text-xs text-surface-600">No issues or delays reported.</p>
        )}
        {report.safety_incidents ? (
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Safety Incidents</p>
            <p className="text-sm text-red-300 whitespace-pre-wrap">{report.safety_incidents}</p>
          </div>
        ) : (
          <p className="text-xs text-surface-600">No safety incidents reported.</p>
        )}
        <InfoRow label="Visitors on Site" value={report.visitors} />
      </div>

      {/* Section 5 — Report Meta */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">Report Meta</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Report Number" value={report.report_number} />
          <InfoRow label="Created" value={formatDateTime(report.created_at)} />
          <InfoRow label="Status" value={DFR_STATUS_LABELS[report.status as DfrStatus]} />
          {report.approved_at && (
            <InfoRow label="Approved At" value={formatDateTime(report.approved_at)} />
          )}
        </div>
      </div>
    </div>
  )
}
