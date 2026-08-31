'use client'
// Miter — long side / short side of a miter cut
import React, { useState } from 'react'
import { MiterDiagram } from '@/components/field-mode/diagrams/MiterDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { fromFeetInchesFraction, formatLength } from '@/lib/field-mode/calc/types'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

interface Props { displayOpts?: DisplayOpts }

export function MiterCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const [odStr, setOdStr]        = useState('')
  const [angleStr, setAngleStr]  = useState('')
  const [active, setActive]      = useState(false)
  const [result, setResult]      = useState<{ long: string; short: string } | null>(null)
  const [error, setError]        = useState<string | null>(null)

  function compute() {
    setError(null)
    try {
      const od    = fromFeetInchesFraction(odStr)
      const theta = parseFloat(angleStr)
      if (isNaN(theta) || theta <= 0 || theta >= 180) { setError('Angle must be 1–179°'); return }
      const rad = (theta / 2) * Math.PI / 180
      const diffMm = (od._mm / 2) * Math.tan(rad)
      setResult({
        long:  formatLength({ _mm: od._mm / 2 + diffMm } as ReturnType<typeof fromFeetInchesFraction>, displayOpts),
        short: formatLength({ _mm: od._mm / 2 - diffMm } as ReturnType<typeof fromFeetInchesFraction>, displayOpts),
      })
    } catch { setError('Check input') }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <MiterDiagram />
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Pipe OD</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive(true)}>
          {odStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {active && <FractionKeypad value={odStr} onChange={setOdStr} onSubmit={(v) => { setOdStr(v); setActive(false) }} unit="imperial" />}
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Miter Angle (°)</label>
        <input type="number" min="1" max="179" value={angleStr} onChange={e => setAngleStr(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono"
          placeholder="e.g. 45" inputMode="decimal" />
      </div>
      <button type="button" onClick={compute} className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base">Calculate</button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex flex-col gap-2">
          <div className="flex justify-between"><span className="text-surface-400 text-sm">LONG SIDE</span><span className="text-surface-100 font-mono text-lg">{result.long}</span></div>
          <div className="flex justify-between"><span className="text-surface-400 text-sm">SHORT SIDE</span><span className="text-surface-100 font-mono text-lg">{result.short}</span></div>
        </div>
      )}
    </div>
  )
}
