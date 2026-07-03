'use client'
import { formatDateTime } from '@/lib/utils'
import { WELD_STATUS_LABELS, type WeldStatus } from '@/types'
import { CheckCircle2, Edit3, PlusCircle } from 'lucide-react'

interface TimelineEntry {
  id:               string
  action:           string
  previous_status?: string | null
  new_status?:      string | null
  performed_by_name?: string
  performed_at:     string
  notes?:           string | null
}

interface WeldTimelineProps {
  entries: TimelineEntry[]
}

function getStatusLabel(s: string | null | undefined): string {
  if (!s) return '—'
  return WELD_STATUS_LABELS[s as WeldStatus] ?? s
}

export function WeldTimeline({ entries }: WeldTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-surface-500 text-center py-8">
        No history yet — updates will appear here.
      </p>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-700" />

      <div className="space-y-0">
        {entries.map((entry, idx) => {
          const isCreate   = entry.action === 'INSERT'
          const hasStatus  = entry.previous_status || entry.new_status
          const isFirst    = idx === entries.length - 1

          return (
            <div key={entry.id} className="relative flex gap-4 pb-6">
              {/* Timeline dot */}
              <div className={`
                relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${isCreate ? 'bg-brand-500/20 ring-2 ring-brand-500/40' : 'bg-surface-700 ring-1 ring-surface-600'}
              `}>
                {isCreate
                  ? <PlusCircle className="w-4 h-4 text-brand-400" />
                  : hasStatus
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <Edit3 className="w-4 h-4 text-surface-400" />
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                {/* Status change arrow */}
                {hasStatus && (
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {entry.previous_status && (
                      <span className="text-xs bg-surface-700 text-surface-400 px-2 py-0.5 rounded font-medium">
                        {getStatusLabel(entry.previous_status)}
                      </span>
                    )}
                    {entry.previous_status && entry.new_status && (
                      <span className="text-surface-600 text-xs">→</span>
                    )}
                    {entry.new_status && (
                      <span className="text-xs bg-brand-500/15 text-brand-300 px-2 py-0.5 rounded font-semibold">
                        {getStatusLabel(entry.new_status)}
                      </span>
                    )}
                  </div>
                )}

                {isCreate && (
                  <p className="text-sm font-semibold text-surface-100 mb-1">Weld Created</p>
                )}

                {/* Notes */}
                {entry.notes && (
                  <p className="text-xs text-surface-400 italic mb-1">&ldquo;{entry.notes}&rdquo;</p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-2 text-xs text-surface-600">
                  <span className="font-medium text-surface-500">
                    {entry.performed_by_name ?? 'Unknown'}
                  </span>
                  <span>·</span>
                  <span>{formatDateTime(entry.performed_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
