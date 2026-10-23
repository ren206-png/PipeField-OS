'use client'
// ============================================================
// ISO Tap-to-Calculate — Step 5: Results
// ============================================================
import React, { useState } from 'react'
import type { ModeAResult, ModeBResult, BwResult, ThreadedResult } from '../engines/schemas'
import { dualFormat } from '@/lib/field-mode/calc/types'

type GeoResult = ModeAResult | ModeBResult

interface ResultsStepProps {
  geoResult: GeoResult
  cutResult: BwResult | ThreadedResult | null
  cutSkipped: boolean
  onStartOver: () => void
}

type DisplayUnit = 'both' | 'imperial' | 'metric'

function fmt(mm: number, unit: DisplayUnit) {
  const d = dualFormat(mm)
  if (unit === 'imperial') return d.imperial
  if (unit === 'metric')   return d.metric
  return `${d.imperial} · ${d.metric}`
}

function Row({ label, mm, unit }: { label: string; mm: number; unit: DisplayUnit }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-surface-800 last:border-0">
      <span className="text-surface-400 text-sm">{label}</span>
      <span className="text-surface-100 font-mono text-sm">{fmt(mm, unit)}</span>
    </div>
  )
}

export function ResultsStep({ geoResult, cutResult, cutSkipped, onStartOver }: ResultsStepProps) {
  const [unit, setUnit] = useState<DisplayUnit>('both')

  const travelMm = geoResult.travel
  const offsetMm = geoResult.trueOffset
  const runMm    = geoResult.kind === 'mode-b' ? geoResult.run : geoResult.travel  // Mode A run comes from input

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Unit toggle */}
      <div className="flex gap-2">
        {(['both', 'imperial', 'metric'] as DisplayUnit[]).map(u => (
          <button key={u} type="button"
            onClick={() => setUnit(u)}
            className={`min-h-[44px] flex-1 rounded-xl border text-xs font-semibold ${unit === u ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-300'}`}>
            {u === 'both' ? 'Both' : u === 'imperial' ? 'in' : 'mm'}
          </button>
        ))}
      </div>

      {/* Geometry results */}
      <div className="bg-surface-900 border border-surface-700 rounded-xl p-4">
        <p className="text-surface-400 text-xs uppercase tracking-wide mb-2">Geometry</p>
        <Row label="True Offset (O)" mm={offsetMm} unit={unit} />
        <Row label="Travel (T) — CL intersection to CL intersection" mm={travelMm} unit={unit} />
        {geoResult.kind === 'mode-a' && (
          <div className="flex justify-between items-center py-2">
            <span className="text-surface-400 text-sm">Required Angle (θ)</span>
            <span className="text-surface-100 font-mono text-sm">{geoResult.thetaDeg.toFixed(4)}°</span>
          </div>
        )}
        {geoResult.kind === 'mode-b' && (
          <Row label="Run (U)" mm={runMm} unit={unit} />
        )}
      </div>

      {/* Cut length results */}
      {cutResult && cutResult.kind === 'bw-result' && (
        <div className="bg-surface-900 border border-green-800 rounded-xl p-4">
          <p className="text-surface-400 text-xs uppercase tracking-wide mb-2">
            Butt-Weld Cut Length
          </p>
          <p className="text-green-400 font-mono text-2xl font-bold">{fmt(cutResult.cutLengthMm, unit)}</p>
          <div className="mt-3 text-xs text-surface-400 space-y-0.5">
            <p>Travel:      {dualFormat(cutResult.breakdown.travel).metric}</p>
            <p>− Fitting A:  {dualFormat(cutResult.breakdown.deductionA).metric}</p>
            <p>− Fitting B:  {dualFormat(cutResult.breakdown.deductionB).metric}</p>
            <p>− Gap A:      {dualFormat(cutResult.breakdown.gapA).metric}</p>
            <p>− Gap B:      {dualFormat(cutResult.breakdown.gapB).metric}</p>
            <p className="text-green-400 font-semibold">= {dualFormat(cutResult.cutLengthMm).metric}</p>
          </div>
        </div>
      )}

      {cutResult && cutResult.kind === 'threaded-result' && (
        <div className="bg-surface-900 border border-blue-800 rounded-xl p-4">
          <p className="text-surface-400 text-xs uppercase tracking-wide mb-1">
            Threaded NPT Cut Length
            <span className="ml-2 font-normal normal-case">(finished end-to-end incl. inserted ends)</span>
          </p>
          {cutResult.cutLengthMm != null
            ? <p className="text-blue-400 font-mono text-2xl font-bold">{fmt(cutResult.cutLengthMm, unit)}</p>
            : <p className="text-amber-400 text-sm">Target engagement not confirmed — range only</p>
          }
          <p className="text-surface-400 text-xs mt-1">
            Range: {dualFormat(cutResult.cutLengthRangeMm[0]).metric} – {dualFormat(cutResult.cutLengthRangeMm[1]).metric}
          </p>
          <div className="mt-2 text-xs text-surface-400 space-y-0.5 font-mono">
            <p>{cutResult.breakdown.formula}</p>
          </div>
          {cutResult.warnings.map((w, i) => (
            <p key={i} className="text-amber-300 text-xs mt-1">⚠ {w}</p>
          ))}
        </div>
      )}

      {/* Geometry-only reason */}
      {(cutSkipped || !cutResult) && (
        <div className="bg-surface-900 border border-surface-700 rounded-xl p-4">
          <p className="text-surface-400 text-sm">
            {cutSkipped
              ? 'Cut length skipped — geometry result only.'
              : 'No fitting data — geometry result only.'}
          </p>
        </div>
      )}

      {/* Save placeholder (Phase 4) */}
      <button
        type="button"
        disabled
        className="min-h-[56px] rounded-xl bg-surface-800 border border-surface-700 text-surface-500 text-sm font-medium cursor-not-allowed"
        title="Offline storage will be added in Phase 4"
      >
        Save Snapshot (offline storage coming in Phase 4)
      </button>

      <button
        type="button"
        onClick={onStartOver}
        className="min-h-[56px] rounded-xl bg-surface-800 text-surface-300 font-semibold"
      >
        Start Over
      </button>
    </div>
  )
}
