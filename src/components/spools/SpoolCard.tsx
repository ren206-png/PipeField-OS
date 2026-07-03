'use client'
import { memo } from 'react'
import Link from 'next/link'
import { ChevronRight, Layers, Package, MapPin, Calendar } from 'lucide-react'
import { SpoolStatusBadge } from './SpoolStatusBadge'
import { formatDate } from '@/lib/utils'
import type { SpoolStatus } from '@/types'

interface SpoolCardProps {
  id:            string
  spoolNumber:   string
  revision:      string | null
  status:        SpoolStatus
  projectName:   string
  pipeSize:      string | null
  material:      string | null
  area:          string | null
  isometricRef:  string | null
  totalWelds:    number
  itemCount:     number
  requiredDate:  string | null
  priority:      number
  onMouseEnter?: () => void
}

// Priority color — 1 is most urgent (red), 5 normal, 10 low (grey)
function priorityColor(p: number) {
  if (p <= 2) return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (p <= 4) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
  return 'bg-surface-700 text-surface-500'
}

// memo prevents unnecessary re-renders when the spool list updates but this card's props are unchanged.
export const SpoolCard = memo(function SpoolCard({
  id, spoolNumber, revision, status, projectName,
  pipeSize, material, area, isometricRef,
  totalWelds, itemCount, requiredDate, priority,
  onMouseEnter,
}: SpoolCardProps) {
  return (
    <Link
      href={`/spools/${id}`}
      onMouseEnter={onMouseEnter}
      className="card block hover:border-surface-600 hover:shadow-card-lg transition-all duration-150 group"
    >
      <div className="p-4 sm:p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-surface-50 font-mono tracking-tight">
                {spoolNumber}
              </span>
              {revision && (
                <span className="text-xs text-surface-500 font-mono">Rev {revision}</span>
              )}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${priorityColor(priority)}`}>
                P{priority}
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">{projectName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SpoolStatusBadge status={status} />
            <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {pipeSize && (
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Size</p>
                <p className="text-sm font-bold text-brand-300 font-mono mt-0.5">{pipeSize}</p>
              </div>
            </div>
          )}
          {material && (
            <div className="flex items-center gap-2 min-w-0">
              <Package className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Material</p>
                <p className="text-sm text-surface-200 truncate mt-0.5">{material}</p>
              </div>
            </div>
          )}
          {area && (
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Area</p>
                <p className="text-sm text-surface-200 truncate mt-0.5">{area}</p>
              </div>
            </div>
          )}
          {requiredDate && (
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-surface-500 leading-none">Required</p>
                <p className="text-sm text-surface-200 mt-0.5">{formatDate(requiredDate)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer counts */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-700/60 text-xs text-surface-600">
          {isometricRef && <span className="font-mono text-surface-500">{isometricRef}</span>}
          <span className="ml-auto flex items-center gap-3">
            <span>{totalWelds} weld{totalWelds !== 1 ? 's' : ''}</span>
            {itemCount > 0 && <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>}
          </span>
        </div>
      </div>
    </Link>
  )
}

)