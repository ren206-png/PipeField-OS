'use client'

interface Props {
  totalWelds:    number
  completionPct: number
  firstPassRate: number
  rejectionRate: number
}

export function ProjectStatsBar({ totalWelds, completionPct, firstPassRate, rejectionRate }: Props) {
  const stats = [
    { label: 'Total Welds',     value: totalWelds,        suffix: '',  color: 'text-surface-50' },
    { label: 'Completion',      value: completionPct,     suffix: '%', color: 'text-green-400'  },
    { label: 'First Pass Rate', value: firstPassRate,     suffix: '%', color: firstPassRate >= 95 ? 'text-green-400' : firstPassRate >= 85 ? 'text-yellow-400' : 'text-red-400' },
    { label: 'Rejection Rate',  value: rejectionRate,     suffix: '%', color: rejectionRate <= 5  ? 'text-green-400' : rejectionRate <= 15 ? 'text-yellow-400' : 'text-red-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="card p-5 text-center">
          <p className={`text-3xl font-bold leading-none ${s.color}`}>
            {s.value}{s.suffix}
          </p>
          <p className="text-xs text-surface-500 mt-2">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
