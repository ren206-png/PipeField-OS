// ============================================================
// OffsetPanel — Simple & Rolling Offset Calculator
// Two modes:
//   Simple  — one plane offset (Set only)
//   Rolling — two-plane offset (Set + Roll)
// ============================================================
'use client'

import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { OFFSET_ANGLES, type OffsetAngle } from '@/config/pipe-data'
import {
  calculateSimpleOffset,
  calculateRollingOffset,
  parseFraction,
  toFeetInches,
  roundToSixteenth,
  formatInches,
} from '@/lib/calculator/pipe-calculations'
import { ResultCard } from './ResultCard'

type OffsetMode = 'simple' | 'rolling'

export function OffsetPanel() {
  const [mode, setMode] = useState<OffsetMode>('simple')

  // Common
  const [angleOpt, setAngleOpt]       = useState<OffsetAngle>('45')
  const [customAngle, setCustomAngle] = useState('')

  // Simple offset
  const [offset, setOffset]           = useState('')

  // Rolling offset
  const [set, setSet]                 = useState('')
  const [roll, setRoll]               = useState('')

  const angleDegrees = angleOpt === 'custom'
    ? parseFloat(customAngle) || 45
    : parseFloat(angleOpt)

  const offsetInches  = parseFraction(offset) ?? 0
  const setInches     = parseFraction(set)    ?? 0
  const rollInches    = parseFraction(roll)   ?? 0

  const simpleResult = mode === 'simple' && offsetInches > 0
    ? calculateSimpleOffset({ offsetInches, angleDegrees })
    : null

  const rollingResult = mode === 'rolling' && (setInches > 0 || rollInches > 0)
    ? calculateRollingOffset({ setInches, rollInches, angleDegrees })
    : null

  function reset() {
    setOffset('')
    setSet('')
    setRoll('')
    setCustomAngle('')
  }

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="flex rounded-xl overflow-hidden border border-surface-700 p-1 gap-1 bg-surface-800/50">
        {([
          { value: 'simple',  label: 'Simple Offset',  sub: 'One plane' },
          { value: 'rolling', label: 'Rolling Offset',  sub: 'Set + Roll' },
        ] as const).map(tab => (
          <button
            key={tab.value}
            onClick={() => setMode(tab.value)}
            className={`flex-1 rounded-lg py-2.5 px-3 text-sm font-medium transition-all ${
              mode === tab.value
                ? 'bg-brand-500 text-white shadow-glow'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <span className="block">{tab.label}</span>
            <span className={`text-xs ${mode === tab.value ? 'text-brand-100/70' : 'text-surface-600'}`}>
              {tab.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Angle selector */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Elbow Angle</label>
          <div className="relative">
            <select
              value={angleOpt}
              onChange={e => setAngleOpt(e.target.value as OffsetAngle)}
              className="input appearance-none pr-8 cursor-pointer"
            >
              {OFFSET_ANGLES.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
        </div>
        <div>
          {angleOpt === 'custom' ? (
            <>
              <label className="label">Custom Angle (°)</label>
              <input
                type="number" min="1" max="89" step="0.5"
                placeholder="e.g. 30"
                value={customAngle}
                onChange={e => setCustomAngle(e.target.value)}
                className="input font-mono"
              />
            </>
          ) : (
            <>
              <label className="label">Angle (decimal)</label>
              <div className="input bg-surface-700/50 text-surface-300 font-mono flex items-center cursor-default">
                {angleDegrees}°
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SIMPLE OFFSET ── */}
      {mode === 'simple' && (
        <div className="space-y-3">
          <div>
            <label className="label">
              Offset Distance
              <span className="ml-1 text-surface-500 font-normal normal-case">(perpendicular shift)</span>
            </label>
            <input
              type="text"
              placeholder='e.g. 12, 12.5, 12-1/2, 1-0-1/2'
              value={offset}
              onChange={e => setOffset(e.target.value)}
              className="input font-mono"
            />
            <p className="text-xs text-surface-500 mt-1">
              Accepts: whole numbers, decimals, fractions (12-1/2)
            </p>
          </div>

          {simpleResult && (
            <div className="space-y-3">
              {/* Diagram hint */}
              <div className="rounded-xl bg-surface-900 border border-surface-700 p-4 text-xs text-surface-400 font-mono">
                <pre className="text-center text-surface-400 leading-6">{`
    ┌────────── RUN ──────────┐
    │                         │
    │   ╲  TRAVEL             │
    │    ╲                    │
    │     ╲  ← ${angleDegrees}° elbows   │ OFFSET
    │      ╲                  │
    │       ╲                 │
    └─────────────────────────┘
`}</pre>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ResultCard
                  label="TRAVEL"
                  value={toFeetInches(roundToSixteenth(simpleResult.travel))}
                  subValue={`${simpleResult.travel.toFixed(4)}" exact`}
                  highlight
                />
                <ResultCard
                  label="RUN"
                  value={toFeetInches(roundToSixteenth(simpleResult.run))}
                  subValue={`${simpleResult.run.toFixed(4)}" exact`}
                  highlight
                />
              </div>

              <ResultCard
                label="Offset"
                value={toFeetInches(offsetInches)}
                subValue={formatInches(offsetInches, 4)}
              />

              <div className="rounded-xl bg-surface-900 border border-surface-700 p-4 font-mono text-xs text-surface-400 space-y-1">
                <p className="text-surface-300 font-semibold mb-2">Formulas:</p>
                <p>Travel = Offset ÷ sin({angleDegrees}°)</p>
                <p>       = {offsetInches.toFixed(4)}&quot; ÷ {Math.sin(angleDegrees * Math.PI / 180).toFixed(6)}</p>
                <p className="text-surface-100">       = {simpleResult.travel.toFixed(4)}&quot;</p>
                <p className="mt-2">Run    = Offset ÷ tan({angleDegrees}°)</p>
                <p>       = {offsetInches.toFixed(4)}&quot; ÷ {Math.tan(angleDegrees * Math.PI / 180).toFixed(6)}</p>
                <p className="text-surface-100">       = {simpleResult.run.toFixed(4)}&quot;</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROLLING OFFSET ── */}
      {mode === 'rolling' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                Set
                <span className="block text-xs font-normal text-surface-500 normal-case">Side-to-side shift</span>
              </label>
              <input
                type="text"
                placeholder='e.g. 9"'
                value={set}
                onChange={e => setSet(e.target.value)}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label">
                Roll
                <span className="block text-xs font-normal text-surface-500 normal-case">Up-down shift</span>
              </label>
              <input
                type="text"
                placeholder='e.g. 7"'
                value={roll}
                onChange={e => setRoll(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>

          {rollingResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ResultCard
                  label="TRUE OFFSET"
                  value={toFeetInches(roundToSixteenth(rollingResult.trueOffset))}
                  subValue={`√(Set² + Roll²) = ${rollingResult.trueOffset.toFixed(4)}"`}
                  highlight
                />
                <ResultCard
                  label="TRAVEL"
                  value={toFeetInches(roundToSixteenth(rollingResult.travel))}
                  subValue={`${rollingResult.travel.toFixed(4)}" exact`}
                  highlight
                />
                <ResultCard
                  label="Set"
                  value={toFeetInches(setInches)}
                  subValue={formatInches(setInches, 4)}
                />
                <ResultCard
                  label="Roll"
                  value={toFeetInches(rollInches)}
                  subValue={formatInches(rollInches, 4)}
                />
              </div>

              <ResultCard
                label="RUN (horizontal distance consumed)"
                value={toFeetInches(roundToSixteenth(rollingResult.run))}
                subValue={`${rollingResult.run.toFixed(4)}" exact`}
              />

              <div className="rounded-xl bg-surface-900 border border-surface-700 p-4 font-mono text-xs text-surface-400 space-y-1">
                <p className="text-surface-300 font-semibold mb-2">Formulas:</p>
                <p>True Offset = √(Set² + Roll²)</p>
                <p>            = √({setInches.toFixed(3)}² + {rollInches.toFixed(3)}²)</p>
                <p className="text-surface-100">            = {rollingResult.trueOffset.toFixed(4)}&quot;</p>
                <p className="mt-2">Travel      = True Offset ÷ sin({angleDegrees}°)</p>
                <p className="text-surface-100">            = {rollingResult.travel.toFixed(4)}&quot;</p>
                <p className="mt-2">Run         = True Offset ÷ tan({angleDegrees}°)</p>
                <p className="text-surface-100">            = {rollingResult.run.toFixed(4)}&quot;</p>
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={reset} className="btn-ghost text-xs gap-1.5">
        <RotateCcw className="w-3.5 h-3.5" />
        Reset
      </button>
    </div>
  )
}
