import { cn } from '@/lib/utils'
import { SPOOL_STATUS_LABELS, SPOOL_STATUS_COLORS, type SpoolStatus } from '@/types'

interface SpoolStatusBadgeProps {
  status: SpoolStatus
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
}

const DOT_COLORS: Record<SpoolStatus, string> = {
  designed:          'bg-surface-500',
  material_released: 'bg-blue-400',
  cut:               'bg-orange-400',
  fit_up:            'bg-brand-400',
  welded:            'bg-yellow-400',
  nde:               'bg-purple-400',
  painted:           'bg-pink-400',
  released:          'bg-emerald-400',
}

export function SpoolStatusBadge({ status, size = 'md' }: SpoolStatusBadgeProps) {
  return (
    <span className={cn(
      'badge font-semibold tracking-wide inline-flex items-center gap-1.5',
      SPOOL_STATUS_COLORS[status],
      SIZE[size]
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_COLORS[status])} />
      {SPOOL_STATUS_LABELS[status]}
    </span>
  )
}
