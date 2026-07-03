'use client'
import { cn } from '@/lib/utils'

interface TopWelder {
  name:   string
  stamp:  string
  total:  number
  passed: number
  rate:   number
}

interface Props {
  data: TopWelder[]
}

function RateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 95 ? 'bg-green-500/15 text-green-300' :
    rate >= 85 ? 'bg-yellow-500/15 text-yellow-300' :
                 'bg-red-500/15 text-red-300'
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', color)}>
      {rate}%
    </span>
  )
}

export function TopWeldersTable({ data }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-800">
        <h3 className="text-sm font-semibold text-surface-200">Top Welders</h3>
      </div>
      {data.length === 0 ? (
        <p className="px-5 py-8 text-center text-surface-500 text-sm">No weld data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-900/50">
                {['Welder', 'Stamp', 'Total', 'Passed', 'Pass Rate'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {data.map((w, i) => (
                <tr key={i} className="hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3 text-surface-200 font-medium">{w.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-400">{w.stamp}</td>
                  <td className="px-4 py-3 text-surface-300">{w.total}</td>
                  <td className="px-4 py-3 text-surface-300">{w.passed}</td>
                  <td className="px-4 py-3"><RateBadge rate={w.rate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
