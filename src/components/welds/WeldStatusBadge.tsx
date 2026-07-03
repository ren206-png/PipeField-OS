import { cn } from '@/lib/utils'
import { WELD_STATUS_LABELS, WELD_STATUS_COLORS, type WeldStatus } from '@/types'

interface WeldStatusBadgeProps {
  status: WeldStatus
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm:  'text-xs px-2 py-0.5',
  md:  'text-xs px-2.5 py-1',
  lg:  'text-sm px-3 py-1.5',
}

// Dot color per status
const DOT_COLORS: Record<WeldStatus, string> = {
  draft:           'bg-surface-500',
  fit_up_approved: 'bg-blue-400',
  welded:          'bg-brand-400',
  visual_pass:     'bg-green-400',
  xray_pending:    'bg-yellow-400',
  failed:          'bg-red-400',
  repaired:        'bg-purple-400',
  accepted:        'bg-emerald-400',
}

export function WeldStatusBadge({ status, size = 'md' }: WeldStatusBadgeProps) {
  return (
    <span className={cn(
      'badge font-semibold tracking-wide inline-flex items-center gap-1.5',
      WELD_STATUS_COLORS[status],
      SIZE[size]
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_COLORS[status])} />
      {WELD_STATUS_LABELS[status]}
    </span>
  )
}
