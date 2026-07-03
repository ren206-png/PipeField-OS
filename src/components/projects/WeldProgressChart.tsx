'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

interface WeldByWeek {
  week:   string
  total:  number
  passed: number
  failed: number
}

interface Props {
  data: WeldByWeek[]
}

export function WeldProgressChart({ data }: Props) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-surface-200 mb-4">Weld Activity — Last 8 Weeks</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: -16, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: '#cbd5e1' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
          />
          <Bar dataKey="passed" name="Passed" fill="#22c55e" stackId="a" radius={[0,0,0,0]} />
          <Bar dataKey="failed" name="Failed"  fill="#ef4444" stackId="a" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
