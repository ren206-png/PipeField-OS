'use client'
// Cut Length — Threaded
import React, { useState } from 'react'
import { CutLengthDiagram } from '@/components/field-mode/diagrams/CutLengthDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { fromFeetInchesFraction, formatLength } from '@/lib/field-mode/calc/types'
import { createSupabaseReferenceAdapter } from '@/lib/field-mode/reference-adapter'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

const NPS_OPTIONS = ['⅛','¼','⅜','½','¾','1','1¼','1½','2','2½','3','4']
const FITTING_TYPES = ['90°', '45°', 'Tee']

interface Props { displayOpts?: DisplayOpts }

export function CutLengthThreadedCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const t = useFieldStrings('en')
  const [ctcStr, setCtcStr] = useState('')
  const [nps, setNps] = useState('1')
  const [fittingType, setFittingType] = useState('90°')
  const [active, setActive] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function compute() {
    setError(null); setLoading(true); setUnverified(false)
    try {
      const adapter = createSupabaseReferenceAdapter()
      const rows = await adapter.getThreadedFitting({ nps, fitting_type: fittingType })
      if (!rows.length) { setError(t.calc_missing_ref('ref_threaded_fittings')); return }
      const row = rows[0]
      if (!row.verified) setUnverified(true)
      const ctc = fromFeetInchesFraction(ctcStr)
      const ctrToEnd = (fittingType === '45°' ? row.data.ctr_to_end_45_in : row.data.ctr_to_end_a_90_tee_in) ?? 0
      const cutMm = ctc._mm - 2 * ctrToEnd * 25.4
      setResult(formatLength({ _mm: cutMm } as ReturnType<typeof fromFeetInchesFraction>, displayOpts))
    } catch { setError('Check input') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <CutLengthDiagram />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">NPS</label>
          <select value={nps} onChange={e => setNps(e.target.value)}
            className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
            {NPS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Fitting</label>
          <select value={fittingType} onChange={e => setFittingType(e.target.value)}
            className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
            {FITTING_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Centre to Centre</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive(true)}>
          {ctcStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {active && <FractionKeypad value={ctcStr} onChange={setCtcStr} onSubmit={(v) => { setCtcStr(v); setActive(false) }} unit="imperial" />}
      <button type="button" onClick={compute} disabled={loading}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-60">
        {loading ? 'Looking up…' : 'Calculate'}
      </button>
      {unverified && <div className="px-3 py-2 rounded-lg bg-amber-900/40 text-amber-300 text-sm">{t.calc_unverified_badge}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex justify-between">
          <span className="text-surface-400 text-sm">CUT LENGTH</span>
          <span className="text-surface-100 font-mono text-lg">{result}</span>
        </div>
      )}
    </div>
  )
}
