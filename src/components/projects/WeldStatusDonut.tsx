'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface WeldByStatus {
  status: string
  count:  number
}

interface Props {
  data:          WeldByStatus[]
  completionPct: number
}

const STATUS_COLORS: Record<string, string> = {
  draft:           '#6b7280',
  fit_up_approved: '#3b82f6',
  welded:          '#f97316',
  visual_pass:     '#14b8a6',
  xray_pending:    '#a855f7',
  failed:          '#ef4444',
  repaired:        '#f59e0b',
  accepted:        '#22c55e',
}

const STATUS_LABELS: Record<string, string> = {
  draft:           'Draft',
  fit_up_approved: 'Fit-Up OK',
  welded:          'Welded',
  visual_pass:     'Visual Pass',
  xray_pending:    'X-Ray Pending',
  failed:          'Failed',
  repaired:        'Repaired',
  accepted:        'Accepted',
}

function CenterLabel({ viewBox, completionPct }: {
  viewBox?: { cx?: number; cy?: number }
  completionPct: number
}) {
  const cx = viewBox?.cx ?? 0
  const cy = viewBox?.cy ?? 0
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.3em" fontSize="22" fontWeight="700" fill="#f1f5f9">
        {completionPct}%
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize="11" fill="#94a3b8">
        Complete
      </tspan>
    </text>
  )
}

export function WeldStatusDonut({ data, completionPct }: Props) {
  const chartData = data.map(d => ({
    name:  STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] ?? '#6b7280',
  }))

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-surface-200 mb-4">Weld Status Breakdown</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <CenterLabel completionPct={completionPct} />
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: '#cbd5e1' }}
            formatter={(value) => [value, 'Welds']}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
