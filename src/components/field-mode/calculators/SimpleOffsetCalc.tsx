'use client'
import React, { useState } from 'react'
import { SimpleOffsetDiagram } from '@/components/field-mode/diagrams/SimpleOffsetDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { fromFeetInchesFraction, formatLength } from '@/lib/field-mode/calc/types'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

// Simple offset: travel = offset / sin(θ), run = offset / tan(θ)
// Angle is derived from fitting type (45°, 22.5°, etc.)
const ANGLES = [
  { label: '45°',   deg: 45 },
  { label: '22½°',  deg: 22.5 },
  { label: '11¼°',  deg: 11.25 },
  { label: '5⅝°',   deg: 5.625 },
  { label: '60°',   deg: 60 },
  { label: '30°',   deg: 30 },
]

interface Props {
  displayOpts?: DisplayOpts
}

export function SimpleOffsetCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const t = useFieldStrings('en')
  const [offsetStr, setOffsetStr] = useState('')
  const [activeField, setActiveField] = useState<'offset' | null>(null)
  const [angleDeg, setAngleDeg] = useState(45)
  const [result, setResult] = useState<{ travel: string; run: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function compute() {
    setError(null)
    try {
      const offset = fromFeetInchesFraction(offsetStr)
      const rad = (angleDeg * Math.PI) / 180
      const travelMm = offset._mm / Math.sin(rad)
      const runMm    = offset._mm / Math.tan(rad)
      setResult({
        travel: formatLength({ _mm: travelMm } as ReturnType<typeof fromFeetInchesFraction>, displayOpts),
        run:    formatLength({ _mm: runMm    } as ReturnType<typeof fromFeetInchesFraction>, displayOpts),
      })
    } catch {
      setError('Check input')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <SimpleOffsetDiagram />

      {/* Angle selector */}
      <div className="flex flex-wrap gap-2">
        {ANGLES.map(a => (
          <button
            key={a.deg}
            type="button"
            onClick={() => setAngleDeg(a.deg)}
            className={`min-h-[56px] px-4 rounded-xl border text-sm font-semibold transition-colors ${
              angleDeg === a.deg
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-surface-800 border-surface-700 text-surface-200'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Offset input */}
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Offset</label>
        <div
          className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text"
          onClick={() => setActiveField('offset')}
        >
          {offsetStr || <span className="text-surface-600">tap to enter…</span>}
        </div>
      </div>

      {activeField === 'offset' && (
        <FractionKeypad
          value={offsetStr}
          onChange={setOffsetStr}
          onSubmit={(v) => { setOffsetStr(v); setActiveField(null); compute() }}
          unit="imperial"
        />
      )}

      <button
        type="button"
        onClick={compute}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base active:bg-blue-600"
      >
        Calculate
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-surface-400 text-sm">TRAVEL</span>
            <span className="text-surface-100 font-mono text-lg">{result.travel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-surface-400 text-sm">RUN</span>
            <span className="text-surface-100 font-mono text-lg">{result.run}</span>
          </div>
        </div>
      )}
    </div>
  )
}
