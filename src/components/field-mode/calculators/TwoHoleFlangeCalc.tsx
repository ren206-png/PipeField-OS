'use client'
// 2-Hole Flange — bolt-hole straddling the centreline
// offset = BC/2 × sin(half_straddle_angle)
import React, { useState } from 'react'
import { TwoHoleFlangesDiagram } from '@/components/field-mode/diagrams/TwoHoleFlangesDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { fromFeetInchesFraction, dualFormat } from '@/lib/field-mode/calc/types'
import { createSupabaseReferenceAdapter } from '@/lib/field-mode/reference-adapter'

const NPS_OPTIONS = ['½','¾','1','1¼','1½','2','2½','3','4','6','8','10','12']
const CLASSES = [150, 300, 600, 900, 1500, 2500]

export function TwoHoleFlangeCalc() {
  const t = useFieldStrings('en')
  const [nps, setNps] = useState('4')
  const [flangeClass, setFlangeClass] = useState(150)
  const [result, setResult] = useState<{ bc: { imperial: string; metric: string }; offset: { imperial: string; metric: string } } | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function compute() {
    setError(null); setLoading(true); setUnverified(false)
    try {
      const adapter = createSupabaseReferenceAdapter()
      const rows = await adapter.getFlange({ nps, flange_class: flangeClass })
      if (!rows.length) { setError(t.calc_missing_ref('ref_flanges')); return }
      const row = rows[0]
      if (!row.verified) setUnverified(true)
      const bcMm = row.data.bolt_circle_mm
      // 2-hole straddle: holes at 90° from each other → offset = BC/2 (holes at top and bottom)
      const offsetMm = bcMm / 2
      setResult({
        bc:     dualFormat(bcMm),
        offset: dualFormat(offsetMm),
      })
    } catch { setError('Check input') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <TwoHoleFlangesDiagram />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">NPS</label>
          <select value={nps} onChange={e => setNps(e.target.value)}
            className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
            {NPS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Class</label>
          <select value={flangeClass} onChange={e => setFlangeClass(Number(e.target.value))}
            className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <button type="button" onClick={compute} disabled={loading}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-60">
        {loading ? 'Looking up…' : 'Look up'}
      </button>
      {unverified && <div className="px-3 py-2 rounded-lg bg-amber-900/40 text-amber-300 text-sm">{t.calc_unverified_badge}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="bg-surface-800 rounded-xl p-4 space-y-3 border border-surface-700">
          <div className="flex justify-between items-center">
            <span className="text-surface-400 text-sm">BOLT CIRCLE</span>
            <div className="text-right">
              <div className="text-surface-100 font-mono text-lg">{result.bc.imperial}</div>
              <div className="text-blue-400 font-mono text-sm">{result.bc.metric}</div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-surface-400 text-sm">HOLE OFFSET (from ℄)</span>
            <div className="text-right">
              <div className="text-surface-100 font-mono text-lg">{result.offset.imperial}</div>
              <div className="text-blue-400 font-mono text-sm">{result.offset.metric}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
