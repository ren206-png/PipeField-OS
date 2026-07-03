// ============================================================
// TakeOutPanel — Take-Out & Pipe Cut Length Calculator
// The core fitting calculator.
// ============================================================
'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, Scissors, RotateCcw } from 'lucide-react'
import {
  FITTING_TYPES, WELD_GAP_OPTIONS,
  type FittingType, type NpsSize, type WeldGapOption,
} from '@/config/pipe-data'
import {
  calculateTakeOut,
  calculateCutLength,
  parseFraction,
  toFeetInches,
  roundToSixteenth,
  formatInches,
} from '@/lib/calculator/pipe-calculations'
import { ResultCard } from './ResultCard'
import { WarningBanner } from './WarningBanner'

interface TakeOutPanelProps {
  nps: NpsSize
}

export function TakeOutPanel({ nps }: TakeOutPanelProps) {
  const [fittingA, setFittingA]         = useState<FittingType>('elbow_90_lr')
  const [fittingB, setFittingB]         = useState<FittingType>('elbow_90_lr')
  const [hasFittingB, setHasFittingB]   = useState(false)
  const [weldGapOpt, setWeldGapOpt]     = useState<WeldGapOption>('1/8')
  const [customGap, setCustomGap]       = useState('')
  const [customCTFA, setCustomCTFA]     = useState('')
  const [customCTFB, setCustomCTFB]     = useState('')
  const [totalRun, setTotalRun]         = useState('')
  const [totalRunUnit, setTotalRunUnit] = useState<'inches' | 'feet'>('inches')

  // Resolve weld gap
  const weldGapInches: number = (() => {
    if (weldGapOpt === 'custom') return parseFloat(customGap) || 0
    return WELD_GAP_OPTIONS.find(o => o.value === weldGapOpt)?.inches ?? 0.125
  })()

  // Calculate take-outs
  const resultA = calculateTakeOut({
    nps,
    fittingType: fittingA,
    weldGapInches,
    customCTF: fittingA === 'custom' ? parseFloat(customCTFA) || undefined : undefined,
  })

  const resultB = hasFittingB
    ? calculateTakeOut({
        nps,
        fittingType: fittingB,
        weldGapInches,
        customCTF: fittingB === 'custom' ? parseFloat(customCTFB) || undefined : undefined,
      })
    : null

  // Resolve total run in inches
  const totalRunRaw = totalRun.trim()
  let totalRunInches = 0
  if (totalRunRaw) {
    const parsed = parseFraction(totalRunRaw)
    if (parsed !== null) {
      totalRunInches = totalRunUnit === 'feet' ? parsed * 12 : parsed
    }
  }

  // Calculate cut length if run is provided
  const cutResult = totalRunInches > 0
    ? calculateCutLength({
        totalRunInches,
        takeOutA: resultA.centerToFace,
        takeOutB: resultB?.centerToFace ?? 0,
        weldGapA: weldGapInches,
        weldGapB: hasFittingB ? weldGapInches : 0,
      })
    : null

  const allWarnings = [...resultA.warnings, ...(resultB?.warnings ?? [])]

  function reset() {
    setTotalRun('')
    setCustomGap('')
    setCustomCTFA('')
    setCustomCTFB('')
  }

  return (
    <div className="space-y-6">
      {/* Fitting A */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="label mb-0">
            {hasFittingB ? 'Fitting — End A' : 'Fitting Type'}
          </label>
          <button
            type="button"
            onClick={() => setHasFittingB(v => !v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              hasFittingB
                ? 'bg-brand-500/20 text-brand-300'
                : 'bg-surface-700 text-surface-400 hover:text-surface-200'
            }`}
          >
            {hasFittingB ? '✓ Two Fittings' : '+ Add End B Fitting'}
          </button>
        </div>

        <div className="relative">
          <select
            value={fittingA}
            onChange={e => setFittingA(e.target.value as FittingType)}
            className="input appearance-none pr-10 cursor-pointer"
          >
            {FITTING_TYPES.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        </div>

        {fittingA === 'custom' && (
          <div>
            <label className="label">Custom Center-to-Face — End A (inches)</label>
            <input
              type="number" step="0.0625" min="0"
              placeholder='e.g. 6.000"'
              value={customCTFA}
              onChange={e => setCustomCTFA(e.target.value)}
              className="input font-mono"
            />
          </div>
        )}
      </div>

      {/* Fitting B */}
      {hasFittingB && (
        <div className="space-y-3 pl-4 border-l-2 border-brand-500/30">
          <label className="label">Fitting — End B</label>
          <div className="relative">
            <select
              value={fittingB}
              onChange={e => setFittingB(e.target.value as FittingType)}
              className="input appearance-none pr-10 cursor-pointer"
            >
              {FITTING_TYPES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
          {fittingB === 'custom' && (
            <div>
              <label className="label">Custom Center-to-Face — End B (inches)</label>
              <input
                type="number" step="0.0625" min="0"
                placeholder='e.g. 6.000"'
                value={customCTFB}
                onChange={e => setCustomCTFB(e.target.value)}
                className="input font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Weld Gap */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Weld Gap (Root Opening)</label>
          <div className="relative">
            <select
              value={weldGapOpt}
              onChange={e => setWeldGapOpt(e.target.value as WeldGapOption)}
              className="input appearance-none pr-8 cursor-pointer"
            >
              {WELD_GAP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
          {weldGapOpt === 'custom' && (
            <input
              type="number" step="0.001" min="0" max="0.5"
              placeholder='e.g. 0.100"'
              value={customGap}
              onChange={e => setCustomGap(e.target.value)}
              className="input font-mono mt-2"
            />
          )}
        </div>

        <div>
          <label className="label">Gap (decimal)</label>
          <div className="input bg-surface-700/50 text-surface-300 font-mono flex items-center cursor-default">
            {weldGapInches.toFixed(4)}&quot;
          </div>
        </div>
      </div>

      {/* Take-out results */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Take-Out Results
        </p>
        <div className={`grid gap-3 ${hasFittingB ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <ResultCard
            label={hasFittingB ? 'CTF — End A' : 'Center-to-Face'}
            value={resultA.centerToFace > 0 ? formatInches(resultA.centerToFace, 4) : '—'}
            subValue={resultA.centerToFace > 0 ? toFeetInches(resultA.centerToFace) : undefined}
            highlight={!hasFittingB}
          />
          <ResultCard
            label={hasFittingB ? 'Take-Out — End A' : 'Take-Out'}
            value={resultA.takeOut > 0 ? formatInches(resultA.takeOut, 4) : '—'}
            subValue={resultA.takeOut > 0 ? toFeetInches(resultA.takeOut) : undefined}
            highlight
          />
          {hasFittingB && resultB && (
            <>
              <ResultCard
                label="CTF — End B"
                value={resultB.centerToFace > 0 ? formatInches(resultB.centerToFace, 4) : '—'}
                subValue={resultB.centerToFace > 0 ? toFeetInches(resultB.centerToFace) : undefined}
              />
              <ResultCard
                label="Take-Out — End B"
                value={resultB.takeOut > 0 ? formatInches(resultB.takeOut, 4) : '—'}
                subValue={resultB.takeOut > 0 ? toFeetInches(resultB.takeOut) : undefined}
                highlight
              />
            </>
          )}
        </div>
      </div>

      {/* Total Run Input → Pipe Cut Length */}
      <div className="space-y-3 pt-2 border-t border-surface-700">
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5" />
          Pipe Cut Length
        </p>

        <div>
          <label className="label">
            {hasFittingB ? 'Face-to-Face Distance' : 'Total Run Length'}
            <span className="ml-1 text-surface-500 font-normal normal-case">(face to face, or overall dimension)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='e.g. 48, 48.375, 4-3/8, 4-3/8"'
              value={totalRun}
              onChange={e => setTotalRun(e.target.value)}
              className="input font-mono flex-1"
            />
            <div className="relative w-28 flex-shrink-0">
              <select
                value={totalRunUnit}
                onChange={e => setTotalRunUnit(e.target.value as 'inches' | 'feet')}
                className="input appearance-none pr-7 cursor-pointer"
              >
                <option value="inches">Inches</option>
                <option value="feet">Feet</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
            </div>
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Accepts: whole numbers, decimals, fractions (3/8), or mixed (4-3/8)
          </p>
        </div>

        {cutResult && (
          <div className="space-y-3">
            <ResultCard
              label="PIPE CUT LENGTH"
              value={toFeetInches(roundToSixteenth(Math.max(0, cutResult.cutLengthInches)))}
              subValue={`${cutResult.cutLengthInches.toFixed(4)}" exact  |  rounded to nearest 1/16"`}
              highlight
            />
            <div className="grid grid-cols-3 gap-3">
              <ResultCard
                label="Run"
                value={formatInches(totalRunInches, 4)}
                subValue={toFeetInches(totalRunInches)}
              />
              <ResultCard
                label="Total Take-Out"
                value={formatInches(cutResult.totalTakeOut, 4)}
              />
              <ResultCard
                label="Total Weld Gap"
                value={formatInches(cutResult.totalWeldGap, 4)}
              />
            </div>

            {/* Formula display */}
            <div className="rounded-xl bg-surface-900 border border-surface-700 p-4 font-mono text-xs text-surface-400 space-y-1">
              <p className="text-surface-300 font-semibold mb-2">Calculation:</p>
              <p>Run           = {totalRunInches.toFixed(4)}&quot;</p>
              <p>- Take-Out A  = {resultA.centerToFace.toFixed(4)}&quot;</p>
              {resultB && <p>- Take-Out B  = {resultB.centerToFace.toFixed(4)}&quot;</p>}
              <p>+ Weld Gap A  = {weldGapInches.toFixed(4)}&quot;</p>
              {hasFittingB && <p>+ Weld Gap B  = {weldGapInches.toFixed(4)}&quot;</p>}
              <div className="border-t border-surface-700 pt-1 mt-1">
                <p className="text-surface-100 font-semibold">= Cut Length  = {cutResult.cutLengthInches.toFixed(4)}&quot;</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <WarningBanner warnings={allWarnings} />

      <button onClick={reset} className="btn-ghost text-xs gap-1.5">
        <RotateCcw className="w-3.5 h-3.5" />
        Reset Fittings
      </button>
    </div>
  )
}
