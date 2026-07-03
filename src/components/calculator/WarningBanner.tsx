// ============================================================
// WarningBanner — shows engineering data disclaimers
// Critical on a safety-relevant construction tool
// ============================================================
import { AlertTriangle } from 'lucide-react'

interface WarningBannerProps {
  warnings: string[]
}

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null

  // Deduplicate warnings
  const unique = warnings.filter((w, i) => warnings.indexOf(w) === i)

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-warning/10 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
        <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
          Engineering Notice
        </span>
      </div>
      <ul className="space-y-1">
        {unique.map((w, i) => (
          <li key={i} className="text-xs text-yellow-300/80 leading-relaxed">
            • {w}
          </li>
        ))}
      </ul>
    </div>
  )
}
