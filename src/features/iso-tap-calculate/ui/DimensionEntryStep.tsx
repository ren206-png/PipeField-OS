'use client'
// ============================================================
// ISO Tap-to-Calculate — Step 3: Dimension Entry & Confirmation
// ============================================================
// Rules:
//   - "Calculate" disabled until ALL fields are confirmed (confirmed=true)
//   - parsed Measurement starts with confirmed=false
//   - User must tick a confirm checkbox per field
//   - OCR "Tap region" is a placeholder — stores coordinates only
// ============================================================
import React, { useState } from 'react'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { parseMeasurement } from '../engines/measurement-parser'
import { computeModeA, computeModeB } from '../engines/geometry-engine'
import type { Measurement, ParseResult, ModeAResult, ModeBResult, GeometryError } from '../engines/schemas'
import type { CalcMode } from './ModeSelectStep'
import { dualFormat } from '@/lib/field-mode/calc/types'

// A field state for one dimension
interface FieldState {
  raw: string
  measurement: Measurement | null
  parseError: string | null
  confirmed: boolean
  unit: 'imperial' | 'metric'
}

function emptyField(): FieldState {
  return { raw: '', measurement: null, parseError: null, confirmed: false, unit: 'imperial' }
}

type GeometryOutput = ModeAResult | ModeBResult | GeometryError | null

interface DimensionEntryStepProps {
  mode: CalcMode
  imageLoaded: boolean
  onResult: (result: ModeAResult | ModeBResult) => void
  onBack: () => void
}

const FIELD_LABELS: Record<string, string> = {
  rise: 'Rise (V) — perpendicular height difference',
  roll: 'Roll (H) — side-to-side difference',
  run:  'Run (U) — axial distance between elbow centrelines',
  angle: 'Elbow angle (θ) — degrees',
}

function parseField(raw: string, unit: 'imperial' | 'metric'): { m: Measurement | null; err: string | null } {
  if (!raw.trim()) return { m: null, err: null }
  const ctx = { allowNegative: false, projectUnit: unit === 'metric' ? 'mm' as const : 'in' as const, sourceType: 'manual' as const }
  const result: ParseResult = parseMeasurement(raw, ctx)
  if (result.kind === 'measurement') return { m: result, err: null }
  if (result.kind === 'ambiguity') return { m: null, err: `Ambiguous: ${result.reason}` }
  return { m: null, err: result.reason }
}

export function DimensionEntryStep({ mode, imageLoaded, onResult, onBack }: DimensionEntryStepProps) {
  const [rise,  setRise]  = useState<FieldState>(emptyField())
  const [roll,  setRoll]  = useState<FieldState>(emptyField())
  const [run,   setRun]   = useState<FieldState>(emptyField())
  const [angleDegStr, setAngleDegStr] = useState('')
  const [angleDeg, setAngleDeg]       = useState<number | null>(null)
  const [angleConfirmed, setAngleConfirmed] = useState(false)

  const [activeField, setActiveField] = useState<'rise' | 'roll' | 'run' | null>(null)
  const [geoResult, setGeoResult]     = useState<GeometryOutput>(null)

  const fields = mode === 'mode-a'
    ? (['rise', 'roll', 'run'] as const)
    : (['rise', 'roll'] as const)

  const fieldMap = { rise, roll, run }
  const fieldSetters = {
    rise:  (s: FieldState) => { setRise(s); setGeoResult(null) },
    roll:  (s: FieldState) => { setRoll(s); setGeoResult(null) },
    run:   (s: FieldState) => { setRun(s);  setGeoResult(null) },
  }

  function updateRaw(id: 'rise' | 'roll' | 'run', raw: string, unit: 'imperial' | 'metric') {
    const { m, err } = parseField(raw, unit)
    fieldSetters[id]({ raw, measurement: m, parseError: err, confirmed: false, unit })
  }

  function confirm(id: 'rise' | 'roll' | 'run', checked: boolean) {
    const prev = fieldMap[id]
    fieldSetters[id]({ ...prev, confirmed: checked && prev.measurement !== null })
  }

  function updateAngle(raw: string) {
    setAngleDegStr(raw)
    setAngleConfirmed(false)
    setGeoResult(null)
    const n = parseFloat(raw)
    setAngleDeg(isNaN(n) ? null : n)
  }

  const allConfirmed = mode === 'mode-a'
    ? (rise.confirmed && roll.confirmed && run.confirmed)
    : (rise.confirmed && roll.confirmed && angleConfirmed && angleDeg !== null)

  function calculate() {
    if (!allConfirmed) return

    if (mode === 'mode-a') {
      const r = computeModeA({
        rise: { ...rise.measurement!, confirmed: true },
        roll: { ...roll.measurement!, confirmed: true },
        run:  { ...run.measurement!,  confirmed: true },
      })
      setGeoResult(r)
      if (r.kind === 'mode-a') onResult(r)
    } else {
      const r = computeModeB({
        rise:  { ...rise.measurement!, confirmed: true },
        roll:  { ...roll.measurement!, confirmed: true },
        angleDeg: angleDeg!,
      })
      setGeoResult(r)
      if (r.kind === 'mode-b') onResult(r)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Dimension fields */}
      {fields.map(id => {
        const fs = fieldMap[id]
        return (
          <div key={id}>
            <label className="block text-xs text-surface-400 uppercase tracking-wide mb-1">
              {FIELD_LABELS[id]}
            </label>
            <div className="flex gap-2 mb-1">
              {/* Unit toggle */}
              <button
                type="button"
                onClick={() => updateRaw(id, fs.raw, fs.unit === 'imperial' ? 'metric' : 'imperial')}
                className="min-h-[44px] px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-300 text-xs font-mono"
              >
                {fs.unit === 'imperial' ? 'in' : 'mm'}
              </button>
              {/* Display box — tap to activate keypad */}
              <div
                role="button"
                tabIndex={0}
                className="flex-1 min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text"
                onClick={() => setActiveField(id)}
                onKeyDown={e => e.key === 'Enter' && setActiveField(id)}
              >
                {fs.raw || <span className="text-surface-600">tap…</span>}
              </div>
              {/* Tap region placeholder (future OCR) */}
              {imageLoaded && (
                <button
                  type="button"
                  title="Tap a number on the drawing"
                  className="min-h-[56px] min-w-[56px] rounded-xl bg-surface-800 border border-surface-700 text-amber-400 text-xl flex items-center justify-center"
                  aria-label="Tap a region on the drawing"
                  onClick={() => {/* Phase 3 OCR placeholder — stores region coords when image is tapped */}}
                >
                  ⊹
                </button>
              )}
            </div>

            {/* Parse feedback */}
            {fs.parseError && (
              <p className="text-red-400 text-xs mb-1" role="alert">{fs.parseError}</p>
            )}
            {fs.measurement && !fs.parseError && (
              <p className="text-green-400 text-xs mb-1">
                {dualFormat(fs.measurement.valueMm).imperial} · {dualFormat(fs.measurement.valueMm).metric}
              </p>
            )}

            {/* Confirm checkbox */}
            {fs.measurement && !fs.parseError && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fs.confirmed}
                  onChange={e => confirm(id, e.target.checked)}
                  className="w-5 h-5 rounded border-surface-600 bg-surface-800 accent-blue-600"
                />
                <span className="text-surface-300 text-sm">Confirm this value</span>
              </label>
            )}
          </div>
        )
      })}

      {/* Angle field for Mode B */}
      {mode === 'mode-b' && (
        <div>
          <label className="block text-xs text-surface-400 uppercase tracking-wide mb-1">
            {FIELD_LABELS['angle']}
          </label>
          <div className="flex gap-2 mb-1">
            <input
              type="number"
              min="0.001" max="89.999" step="0.5"
              value={angleDegStr}
              onChange={e => updateAngle(e.target.value)}
              placeholder="e.g. 45"
              className="flex-1 min-h-[56px] px-4 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 text-lg font-mono"
            />
          </div>
          {/* Quick-pick common angles */}
          <div className="flex gap-2 flex-wrap mb-1">
            {[45, 22.5, 30, 60].map(a => (
              <button key={a} type="button"
                onClick={() => updateAngle(String(a))}
                className={`min-h-[44px] px-3 rounded-xl border text-sm font-semibold ${angleDeg===a ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200'}`}>
                {a}°
              </button>
            ))}
          </div>
          {angleDeg !== null && !angleConfirmed && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={angleConfirmed}
                onChange={e => setAngleConfirmed(e.target.checked)}
                className="w-5 h-5 rounded border-surface-600 bg-surface-800 accent-blue-600"
              />
              <span className="text-surface-300 text-sm">Confirm {angleDeg}°</span>
            </label>
          )}
          {angleConfirmed && (
            <p className="text-green-400 text-xs">Confirmed: {angleDeg}°</p>
          )}
        </div>
      )}

      {/* Active keypad */}
      {activeField && (
        <FractionKeypad
          value={fieldMap[activeField]?.raw ?? ''}
          onChange={v => updateRaw(activeField, v, fieldMap[activeField]?.unit ?? 'imperial')}
          onSubmit={v => { updateRaw(activeField, v, fieldMap[activeField]?.unit ?? 'imperial'); setActiveField(null) }}
          unit={fieldMap[activeField]?.unit ?? 'imperial'}
        />
      )}

      {/* Geometry result */}
      {geoResult && geoResult.kind === 'geometry-error' && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-3">
          <p className="text-red-400 text-sm font-medium">Calculation error</p>
          <p className="text-red-300 text-xs mt-1">{geoResult.reason} ({geoResult.field})</p>
        </div>
      )}

      <button
        type="button"
        onClick={calculate}
        disabled={!allConfirmed}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Calculate
      </button>

      <button
        type="button"
        onClick={onBack}
        className="min-h-[56px] rounded-xl bg-surface-800 text-surface-400 text-sm font-medium"
      >
        ← Back
      </button>
    </div>
  )
}
