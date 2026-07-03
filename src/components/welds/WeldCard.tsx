'use client'
import { memo, useState } from 'react'
import Link from 'next/link'
import { Calendar, User, Tag, Package, ChevronRight } from 'lucide-react'
import { WeldStatusBadge } from './WeldStatusBadge'
import { InlineStatusMenu } from './InlineStatusMenu'
import { formatDate } from '@/lib/utils'
import type { WeldStatus } from '@/types'

interface WeldCardProps {
  id:               string
  weldIdNumber:     string
  status:           WeldStatus
  welderStamp:      string | null
  welderName:       string | null
  weldDate:         string | null
  projectName:      string
  spoolNumber:      string | null
  notes:            string | null
  photoCount?:      number
  onMouseEnter?:    () => void
  onStatusUpdate?:  () => void
}

// memo prevents re-renders when the parent list re-renders but this card's props haven't changed.
// Particularly effective when status updates on one weld would otherwise re-render the entire list.
export const WeldCard = memo(function WeldCard({
  id, weldIdNumber, status, welderStamp, welderName,
  weldDate, projectName, spoolNumber, notes, photoCount = 0,
  onMouseEnter, onStatusUpdate,
}: WeldCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  return (
    <Link
      href={`/welds/${id}`}
      onMouseEnter={onMouseEnter}
      className="card block hover:border-surface-600 hover:shadow-card-lg transition-all duration-150 group"
    >
      <div className="p-4 sm:p-5">
        {/* Top row — Weld ID + Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-surface-50 font-mono tracking-tight">
                {weldIdNumber}
              </span>
              {photoCount > 0 && (
                <span className="text-xs text-surface-500 bg-surface-700 px-1.5 py-0.5 rounded">
                  {photoCount} 📷
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">{projectName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              {onStatusUpdate ? (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setShowStatusMenu(p => !p) }}
                  className="focus:outline-none"
                  title="Click to update status"
                >
                  <WeldStatusBadge status={status} />
                </button>
              ) : (
                <WeldStatusBadge status={status} />
              )}
              {showStatusMenu && onStatusUpdate && (
                <InlineStatusMenu
                  weldId={id}
                  currentStatus={status}
                  onUpdated={onStatusUpdate}
                  onClose={() => setShowStatusMenu(false)}
                />
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {welderStamp && (
            <div className="flex items-center gap-2 min-w-0">
              <Tag className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Stamp</p>
                <p className="text-sm font-bold text-brand-300 font-mono mt-0.5">{welderStamp}</p>
              </div>
            </div>
          )}
          {welderName && (
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Welder</p>
                <p className="text-sm text-surface-200 truncate mt-0.5">{welderName}</p>
              </div>
            </div>
          )}
          {weldDate && (
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Date</p>
                <p className="text-sm text-surface-200 mt-0.5">{formatDate(weldDate)}</p>
              </div>
            </div>
          )}
          {spoolNumber && (
            <div className="flex items-center gap-2 min-w-0">
              <Package className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Spool</p>
                <p className="text-sm font-mono text-surface-200 mt-0.5">{spoolNumber}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {notes && (
          <p className="mt-3 text-xs text-surface-500 line-clamp-2 border-t border-surface-700/60 pt-3">
            {notes}
          </p>
        )}
      </div>
    </Link>
  )
}

)