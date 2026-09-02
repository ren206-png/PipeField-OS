'use client'
import React, { useState } from 'react'
import { SimpleOffsetDiagram } from '@/components/field-mode/diagrams/SimpleOffsetDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { fromFeetInchesFraction, dualFormat } from '@/lib/field-mode/calc/types'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

// Parallel offsets: shift = spacing / sin(θ) gives the travel offset
interface Props { displayOpts?: DisplayOpts }

export function ParallelOffsetsCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const [spacingStr, setSpacingStr] = useState('')
  const [active, setActive]         = useState(false)
  const [angleDeg, setAngleDeg]     = useState(45)
  const [result, setResult]         = useState<{ imperial: string; metric: string } | null>(null)
  const [error, setError]           = useState<string | null>(null)

  function compute() {
    setError(null)
    try {
      const spacing = fromFeetInchesFraction(spacingStr)
      const shiftMm = spacing._mm / Math.sin((angleDeg * Math.PI) / 180)
      setResult(dualFormat(shiftMm))
    } catch { setError('Check input') }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <SimpleOffsetDiagram />
      <div className="flex flex-wrap gap-2">
        {[45, 22.5, 11.25].map(a => (
          <button key={a} type="button" onClick={() => setAngleDeg(a)}
            className={`min-h-[56px] px-4 rounded-xl border text-sm font-semibold ${angleDeg===a ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200'}`}>
            {a}°
          </button>
        ))}
      </div>
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Pipe Spacing (C to C)</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive(true)}>
          {spacingStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {active && <FractionKeypad value={spacingStr} onChange={setSpacingStr} onSubmit={(v) => { setSpacingStr(v); setActive(false); compute() }} unit="imperial" />}
      <button type="button" onClick={compute} className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base">Calculate</button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="bg-surface-800 rounded-xl p-4 space-y-2 border border-surface-700">
          <div className="flex justify-between items-center">
            <span className="text-surface-400 text-sm">TRAVEL SHIFT</span>
            <div className="text-right">
              <div className="text-surface-100 font-mono text-lg">{result.imperial}</div>
              <div className="text-blue-400 font-mono text-sm">{result.metric}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
