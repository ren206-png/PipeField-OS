'use client'
// ============================================================
// ProgressCharts — recharts-backed S-curve charts for the
// progress report page. Extracted so next/dynamic can lazy-
// load recharts only when the charts are actually rendered.
// ============================================================
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface CurvePoint {
  period: string
  count: number
  cumulative: number
}

interface ProgressChartsProps {
  weldCurve:  CurvePoint[]
  spoolCurve: CurvePoint[]
}

export function ProgressCharts({ weldCurve, spoolCurve }: ProgressChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Weld Progress */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Weld Progress</h2>
        {weldCurve.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
            No weld data with dates for this project
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weldCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="weldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#f97316' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Welds"
                stroke="#f97316"
                fill="url(#weldGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Spool Progress */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Spool Release Progress</h2>
        {spoolCurve.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
            No released spools with dates for this project
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={spoolCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spoolGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Spools Released"
                stroke="#3b82f6"
                fill="url(#spoolGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
