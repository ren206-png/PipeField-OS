interface ResultItem {
  label: string
  value: string
  unit?: string
  highlight?: boolean
}

export function CalcResultCard({ results, title }: { results: ResultItem[]; title?: string }) {
  return (
    <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5">
      {title && <h3 className="text-sm font-semibold text-brand-400 mb-4 uppercase tracking-wide">{title}</h3>}
      <div className="space-y-3">
        {results.map(r => (
          <div key={r.label} className={`flex items-center justify-between py-2 ${r.highlight ? 'border-b border-brand-500/20' : ''}`}>
            <span className="text-sm text-surface-400">{r.label}</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-bold tabular-nums ${r.highlight ? 'text-2xl text-brand-400' : 'text-lg text-surface-50'}`}>
                {r.value}
              </span>
              {r.unit && <span className="text-xs text-surface-500">{r.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
