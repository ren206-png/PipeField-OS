'use client'
// ============================================================
// ISO Tap-to-Calculate — Step 3: Dimension Entry & Confirmation
// ============================================================
// Rules:
//   - "Calculate" disabled until ALL fields are confirmed (confirmed=true)
//   - parsed Measurement starts with confirmed=false
//   - User must tick a confirm checkbox per field
//   - OCR result is never auto-confirmed; user must check the checkbox
//   - TesseractAdapter is lazy-init on first "Tap region" press,
//     reused across fields in the same session
// ============================================================
import React, { useState, useRef, useCallback } from 'react'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { parseMeasurement } from '../engines/measurement-parser'
import { computeModeA, computeModeB } from '../engines/geometry-engine'
import type { Measurement, ParseResult, ModeAResult, ModeBResult, GeometryError } from '../engines/schemas'
import type { CalcMode } from './ModeSelectStep'
import { dualFormat } from '@/lib/field-mode/calc/types'
import { OverlayCanvas } from './OverlayCanvas'
import type { OcrRegion } from '../ocr/ocr-adapter'

// A field state for one dimension
interface FieldState {
  raw: string
  measurement: Measurement | null
  parseError: string | null
  confirmed: boolean
  unit: 'imperial' | 'metric'
  ocrWarning?: string
}

function emptyField(): FieldState {
  return { raw: '', measurement: null, parseError: null, confirmed: false, unit: 'imperial' }
}

type GeometryOutput = ModeAResult | ModeBResult | GeometryError | null

interface DimensionEntryStepProps {
  mode: CalcMode
  imageBlob?: Blob | null
  imageNaturalWidth?: number
  imageNaturalHeight?: number
  rotation?: 0 | 90 | 180 | 270
  onResult: (result: ModeAResult | ModeBResult) => void
  onBack: () => void
}

const FIELD_LABELS: Record<string, string> = {
  rise:  'Rise (V) — perpendicular height difference',
  roll:  'Roll (H) — side-to-side difference',
  run:   'Run (U) — axial distance between elbow centrelines',
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

export function DimensionEntryStep({
  mode,
  imageBlob,
  imageNaturalWidth = 0,
  imageNaturalHeight = 0,
  rotation = 0,
  onResult,
  onBack,
}: DimensionEntryStepProps) {
  const [rise,  setRise]  = useState<FieldState>(emptyField())
  const [roll,  setRoll]  = useState<FieldState>(emptyField())
  const [run,   setRun]   = useState<FieldState>(emptyField())
  const [angleDegStr, setAngleDegStr] = useState('')
  const [angleDeg, setAngleDeg]       = useState<number | null>(null)
  const [angleConfirmed, setAngleConfirmed] = useState(false)

  const [activeField, setActiveField]         = useState<'rise' | 'roll' | 'run' | null>(null)
  // Which field is awaiting an OCR region tap
  const [ocrTargetField, setOcrTargetField]   = useState<'rise' | 'roll' | 'run' | null>(null)
  const [ocrPending, setOcrPending]           = useState(false)
  const [geoResult, setGeoResult]             = useState<GeometryOutput>(null)

  // Lazy TesseractAdapter — created once on first tap, reused
  const ocrAdapterRef = useRef<import('../ocr/tesseract-adapter').TesseractAdapter | null>(null)

  const getOcrAdapter = useCallback(async () => {
    if (!ocrAdapterRef.current) {
      const { TesseractAdapter } = await import('../ocr/tesseract-adapter')
      ocrAdapterRef.current = new TesseractAdapter()
    }
    return ocrAdapterRef.current
  }, [])

  const imageLoaded = !!(imageBlob && imageNaturalWidth && imageNaturalHeight)

  const fields = mode === 'mode-a'
    ? (['rise', 'roll', 'run'] as const)
    : (['rise', 'roll'] as const)

  const fieldMap = { rise, roll, run }
  const fieldSetters = {
    rise:  (s: FieldState) => { setRise(s); setGeoResult(null) },
    roll:  (s: FieldState) => { setRoll(s); setGeoResult(null) },
    run:   (s: FieldState) => { setRun(s);  setGeoResult(null) },
  }

  function updateRaw(id: 'rise' | 'roll' | 'run', raw: string, unit: 'imperial' | 'metric', ocrWarning?: string) {
    const { m, err } = parseField(raw, unit)
    fieldSetters[id]({ raw, measurement: m, parseError: err, confirmed: false, unit, ocrWarning })
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

  // Called when user selects a region on the overlay canvas
  async function onRegionSelected(region: OcrRegion) {
    if (!ocrTargetField || !imageBlob) return
    const targetId = ocrTargetField
    setOcrTargetField(null)
    setOcrPending(true)

    try {
      const adapter = await getOcrAdapter()
      const result  = await adapter.recognizeRegion(imageBlob, region)
      const raw     = result.rawText.trim()
      const warning = result.confidence < 0.5
        ? `Low OCR confidence (${Math.round(result.confidence * 100)}%) — please verify`
        : undefined

      if (raw) {
        // Parse as OCR source — never auto-confirmed
        const { m, err } = parseField(raw, fieldMap[targetId].unit)
        fieldSetters[targetId]({
          raw,
          measurement: m ? { ...m, sourceType: 'ocr' as const, confirmed: false } : null,
          parseError: err,
          confirmed: false,
          unit: fieldMap[targetId].unit,
          ocrWarning: warning,
        })
      } else {
        fieldSetters[targetId]({
          ...fieldMap[targetId],
          ocrWarning: 'OCR found no text in that region — try a larger area or enter manually',
        })
      }
    } catch {
      fieldSetters[targetId]({
        ...fieldMap[targetId],
        ocrWarning: 'OCR failed — please enter manually',
      })
    } finally {
      setOcrPending(false)
    }
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
        rise:     { ...rise.measurement!, confirmed: true },
        roll:     { ...roll.measurement!, confirmed: true },
        angleDeg: angleDeg!,
      })
      setGeoResult(r)
      if (r.kind === 'mode-b') onResult(r)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Image overlay in selection mode */}
      {imageLoaded && ocrTargetField && (
        <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: `${imageNaturalWidth}/${imageNaturalHeight}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={URL.createObjectURL(imageBlob)}
            alt="Drawing"
            className="w-full h-full object-contain"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
          <OverlayCanvas
            imageNaturalWidth={imageNaturalWidth}
            imageNaturalHeight={imageNaturalHeight}
            rotation={rotation}
            boxes={[]}
            selectionMode
            onRegionSelected={onRegionSelected}
          />
          <div className="absolute top-2 left-0 right-0 flex justify-center">
            <span className="bg-blue-800/90 text-white text-xs rounded-full px-3 py-1">
              Drag to select the dimension on the drawing
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOcrTargetField(null)}
            className="absolute top-2 right-2 min-h-[44px] min-w-[44px] bg-surface-800/80 text-surface-300 rounded-full text-lg flex items-center justify-center"
            aria-label="Cancel region selection"
          >
            ✕
          </button>
        </div>
      )}

      {ocrPending && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-3 text-center text-surface-300 text-sm animate-pulse">
          Reading dimension…
        </div>
      )}

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
              {/* Tap region — opens image selection mode */}
              {imageLoaded && (
                <button
                  type="button"
                  title="Tap a number on the drawing"
                  className={`min-h-[56px] min-w-[56px] rounded-xl border text-xl flex items-center justify-center transition-colors ${
                    ocrTargetField === id
                      ? 'bg-blue-700 border-blue-500 text-white'
                      : 'bg-surface-800 border-surface-700 text-amber-400'
                  }`}
                  aria-label="Tap a region on the drawing"
                  onClick={() => setOcrTargetField(ocrTargetField === id ? null : id)}
                  disabled={ocrPending}
                >
                  ⊹
                </button>
              )}
            </div>

            {/* OCR warning */}
            {fs.ocrWarning && (
              <p className="text-amber-400 text-xs mb-1" role="alert">{fs.ocrWarning}</p>
            )}
            {/* Parse feedback */}
            {fs.parseError && (
              <p className="text-red-400 text-xs mb-1" role="alert">{fs.parseError}</p>
            )}
            {fs.measurement && !fs.parseError && (
              <p className="text-green-400 text-xs mb-1">
                {dualFormat(fs.measurement.valueMm).imperial} · {dualFormat(fs.measurement.valueMm).metric}
                {fs.measurement.sourceType === 'ocr' && (
                  <span className="text-amber-400 ml-2">(OCR — please verify before confirming)</span>
                )}
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

      {/* Geometry result error */}
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
