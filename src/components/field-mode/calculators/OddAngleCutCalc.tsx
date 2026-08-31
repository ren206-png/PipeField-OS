'use client'
// Odd-Angle Cut from 90
// cut_back = radius × tan(half_angle)
// where half_angle = (90 - desired_angle) / 2
import React, { useState } from 'react'
import { OddAngleDiagram } from '@/components/field-mode/diagrams/OddAngleDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { fromFeetInchesFraction, formatLength } from '@/lib/field-mode/calc/types'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

interface Props { displayOpts?: DisplayOpts }

export function OddAngleCutCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const [radiusStr, setRadiusStr]   = useState('')
  const [angleStr, setAngleStr]     = useState('')
  const [activeField, setActive]    = useState<'radius' | 'angle' | null>(null)
  const [result, setResult]         = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  function compute() {
    setError(null)
    try {
      const radius = fromFeetInchesFraction(radiusStr)
      const angle  = parseFloat(angleStr)
      if (isNaN(angle) || angle <= 0 || angle >= 90) { setError('Angle must be 1–89°'); return }
      const halfAngle = ((90 - angle) / 2) * Math.PI / 180
      const cutBackMm = radius._mm * Math.tan(halfAngle)
      setResult(formatLength({ _mm: cutBackMm } as ReturnType<typeof fromFeetInchesFraction>, displayOpts))
    } catch { setError('Check input') }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <OddAngleDiagram />
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Elbow Radius (C-to-C)</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive('radius')}>
          {radiusStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {activeField === 'radius' && <FractionKeypad value={radiusStr} onChange={setRadiusStr} onSubmit={(v) => { setRadiusStr(v); setActive(null) }} unit="imperial" />}
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Desired Angle (°)</label>
        <input type="number" min="1" max="89" value={angleStr} onChange={e => setAngleStr(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono"
          placeholder="e.g. 67.5" inputMode="decimal" />
      </div>
      <button type="button" onClick={compute} className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base">Calculate</button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex justify-between">
          <span className="text-surface-400 text-sm">CUT BACK</span>
          <span className="text-surface-100 font-mono text-lg">{result}</span>
        </div>
      )}
    </div>
  )
}
