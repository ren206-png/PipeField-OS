// ============================================================
// ResultCard — displays a single calculated output value
// Used on the calculator results panel.
// ============================================================
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ResultCardProps {
  label: string
  value: string
  subValue?: string      // e.g. decimal equivalent
  icon?: LucideIcon
  highlight?: boolean    // Orange accent for primary result
  className?: string
}

export function ResultCard({
  label,
  value,
  subValue,
  icon: Icon,
  highlight = false,
  className,
}: ResultCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-1 transition-colors',
        highlight
          ? 'bg-brand-500/10 border-brand-500/30'
          : 'bg-surface-800 border-surface-700',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', highlight ? 'text-brand-400' : 'text-surface-500')} />
        )}
        <span className={cn('text-xs font-semibold uppercase tracking-wider', highlight ? 'text-brand-400' : 'text-surface-500')}>
          {label}
        </span>
      </div>
      <p className={cn('text-xl font-bold font-mono', highlight ? 'text-brand-300' : 'text-surface-100')}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-surface-500 font-mono">{subValue}</p>
      )}
    </div>
  )
}
