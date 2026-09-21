'use client'
import { useState } from 'react'
import { RollingOffsetDiagram } from '@/components/field-mode/diagrams/RollingOffsetDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { fromFeetInchesFraction, dualFormat } from '@/lib/field-mode/calc/types'

// Rolling offset: true offset = sqrt(rise² + roll²), travel = true_offset / sin(θ)
export function RollingOffsetCalc() {
  const [riseStr, setRiseStr]     = useState('')
  const [rollStr, setRollStr]     = useState('')
  const [activeField, setActive]  = useState<'rise' | 'roll' | null>(null)
  const [angleDeg, setAngleDeg]   = useState(45)
  const [result, setResult]       = useState<{ trueOffset: { imperial: string; metric: string }; travel: { imperial: string; metric: string } } | null>(null)
  const [error, setError]         = useState<string | null>(null)

  function compute() {
    setError(null)
    try {
      const rise = fromFeetInchesFraction(riseStr)
      const roll = fromFeetInchesFraction(rollStr)
      const trueMm  = Math.sqrt(rise._mm ** 2 + roll._mm ** 2)
      const travelMm = trueMm / Math.sin((angleDeg * Math.PI) / 180)
      setResult({
        trueOffset: dualFormat(trueMm),
        travel:     dualFormat(travelMm),
      })
    } catch { setError('Check input') }
  }

  function Field({ id, label, value, onChange }: { id: 'rise' | 'roll'; label: string; value: string; onChange: (v: string) => void }) {
    return (
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">{label}</label>
        <div
          className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text"
          onClick={() => setActive(id)}
        >
          {value || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
    )
  }

  const ANGLES = [45, 22.5, 11.25, 60, 30]

  return (
    <div className="flex flex-col gap-4 p-4">
      <RollingOffsetDiagram />
      <div className="flex flex-wrap gap-2">
        {ANGLES.map(a => (
          <button key={a} type="button" onClick={() => setAngleDeg(a)}
            className={`min-h-[56px] px-4 rounded-xl border text-sm font-semibold ${angleDeg===a ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200'}`}>
            {a}°
          </button>
        ))}
      </div>
      <Field id="rise" label="Rise" value={riseStr} onChange={setRiseStr} />
      <Field id="roll" label="Roll" value={rollStr} onChange={setRollStr} />
      {activeField && (
        <FractionKeypad
          value={activeField === 'rise' ? riseStr : rollStr}
          onChange={activeField === 'rise' ? setRiseStr : setRollStr}
          onSubmit={(v) => { if (activeField === 'rise') setRiseStr(v); else setRollStr(v); setActive(null) }}
          unit="imperial"
        />
      )}
      <button type="button" onClick={compute} className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base">Calculate</button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="bg-surface-800 rounded-xl p-4 space-y-3 border border-surface-700">
          <div className="flex justify-between items-center">
            <span className="text-surface-400 text-sm">TRUE OFFSET</span>
            <div className="text-right">
              <div className="text-surface-100 font-mono text-lg">{result.trueOffset.imperial}</div>
              <div className="text-blue-400 font-mono text-sm">{result.trueOffset.metric}</div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-surface-400 text-sm">TRAVEL</span>
            <div className="text-right">
              <div className="text-surface-100 font-mono text-lg">{result.travel.imperial}</div>
              <div className="text-blue-400 font-mono text-sm">{result.travel.metric}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
