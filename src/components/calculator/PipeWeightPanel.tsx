// ============================================================
// PipeWeightPanel — Pipe Weight & Barlow's Formula Calculator
// Calculates: weight per foot, total run weight, min wall thickness
// Formula: W = 10.69 × (OD - Wall) × Wall  (lb/ft, carbon steel)
// Barlow's: Wall_min = (P × OD) / (2 × SE × Y)
// ============================================================
'use client'

import { useState, useMemo } from 'react'
import { Weight, Gauge, Info } from 'lucide-react'
import {
  PIPE_SCHEDULES,
  getPipeOD, getWallThickness,
  type NpsSize, type PipeSchedule,
} from '@/config/pipe-data'
import { ResultCard } from './ResultCard'

interface PipeWeightPanelProps {
  nps:      NpsSize
  schedule: PipeSchedule
}

// Density factors (lb/ft per unit cross-section area) per material
// Standard formula: W = 10.69 × (OD - Wall) × Wall, but density factor varies
const DENSITY_FACTOR: Record<string, number> = {
  carbon_steel:     10.69,
  stainless_304:    10.84,
  stainless_316:    10.84,
  chrome_moly:      10.69,
  duplex:           10.77,
  hastelloy:        11.64,
  inconel:          11.70,
  pvc:               1.25,   // approximate, lb/ft per in²
  cpvc:              1.30,
}

const MATERIAL_LABELS: Record<string, string> = {
  carbon_steel:  'Carbon Steel (A106)',
  stainless_304: 'Stainless 304/304L',
  stainless_316: 'Stainless 316/316L',
  chrome_moly:   'Chrome-Moly (P11/P22)',
  duplex:        'Duplex 2205',
  hastelloy:     'Hastelloy C-276',
  inconel:       'Inconel 625',
  pvc:           'PVC',
  cpvc:          'CPVC',
}

// Allowable stress values (psi) at 100°F for Barlow's formula
const ALLOWABLE_STRESS: Record<string, number> = {
  carbon_steel:  17_500,
  stainless_304: 20_000,
  stainless_316: 20_000,
  chrome_moly:   15_000,
  duplex:        25_000,
  hastelloy:     22_400,
  inconel:       30_000,
  pvc:            2_000,
  cpvc:           2_000,
}

export function PipeWeightPanel({ nps, schedule }: PipeWeightPanelProps) {
  const [material,    setMaterial]    = useState('carbon_steel')
  const [runLength,   setRunLength]   = useState('')
  const [customOD,    setCustomOD]    = useState('')
  const [customWall,  setCustomWall]  = useState('')
  // Barlow's inputs
  const [pressure,    setPressure]    = useState('')
  const [yieldFactor, setYieldFactor] = useState('0.4')

  const isCustom = schedule === 'custom'

  const od   = isCustom ? parseFloat(customOD)   || 0 : (getPipeOD(nps) ?? 0)
  const wall = isCustom ? parseFloat(customWall)  || 0 : (getWallThickness(nps, schedule) ?? 0)

  const calc = useMemo(() => {
    if (!od || !wall) return null
    const factor = DENSITY_FACTOR[material] ?? 10.69
    const weightPerFoot = factor * (od - wall) * wall
    const totalWeight = runLength
      ? weightPerFoot * parseFloat(runLength)
      : null

    // Barlow's minimum wall thickness
    const P  = parseFloat(pressure) || 0
    const SE = ALLOWABLE_STRESS[material] ?? 17_500
    const Y  = parseFloat(yieldFactor) || 0.4
    const minWall = P > 0 ? (P * od) / (2 * SE + 2 * Y * P) : null
    const wallAdequate = minWall !== null ? wall >= minWall : null

    return { weightPerFoot, totalWeight, minWall, wallAdequate, SE }
  }, [od, wall, material, runLength, pressure, yieldFactor])

  return (
    <div className="space-y-6">
      {/* Pipe selector summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">NPS</label>
          <div className="input bg-surface-700 text-surface-300 cursor-default font-mono text-sm">
            {nps}&quot; NPS
          </div>
        </div>
        <div>
          <label className="label">Schedule</label>
          <div className="input bg-surface-700 text-surface-300 cursor-default font-mono text-sm">
            {PIPE_SCHEDULES.find(s => s.value === schedule)?.label ?? schedule}
          </div>
        </div>
        <div>
          <label className="label">Material</label>
          <select
            value={material}
            onChange={e => setMaterial(e.target.value)}
            className="input"
          >
            {Object.entries(MATERIAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {isCustom && (
          <>
            <div>
              <label className="label">OD (in)</label>
              <input
                type="number" step="0.001" min="0"
                value={customOD}
                onChange={e => setCustomOD(e.target.value)}
                placeholder="e.g. 4.500"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label">Wall Thickness (in)</label>
              <input
                type="number" step="0.001" min="0"
                value={customWall}
                onChange={e => setCustomWall(e.target.value)}
                placeholder="e.g. 0.237"
                className="input font-mono"
              />
            </div>
          </>
        )}
      </div>

      {/* Pipe properties display */}
      {od > 0 && wall > 0 && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-surface-800 rounded-lg p-3 text-center">
            <p className="text-surface-500 mb-1">OD</p>
            <p className="font-mono font-bold text-surface-100">{od.toFixed(3)}&quot;</p>
          </div>
          <div className="bg-surface-800 rounded-lg p-3 text-center">
            <p className="text-surface-500 mb-1">Wall</p>
            <p className="font-mono font-bold text-surface-100">{wall.toFixed(3)}&quot;</p>
          </div>
          <div className="bg-surface-800 rounded-lg p-3 text-center">
            <p className="text-surface-500 mb-1">ID</p>
            <p className="font-mono font-bold text-surface-100">{(od - 2 * wall).toFixed(3)}&quot;</p>
          </div>
        </div>
      )}

      {/* ── Section: Pipe Weight ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-700 pb-2">
          <Weight className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-surface-200">Pipe Weight</h3>
        </div>

        <div>
          <label className="label">
            Run Length (ft) <span className="text-surface-600 font-normal">— optional</span>
          </label>
          <input
            type="number" step="0.01" min="0"
            value={runLength}
            onChange={e => setRunLength(e.target.value)}
            placeholder="e.g. 100"
            className="input font-mono"
          />
        </div>

        {calc ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ResultCard
              label="Weight per Foot"
              value={`${calc.weightPerFoot.toFixed(2)} lb/ft`}
              subValue={`Formula: 10.69 × (OD − Wall) × Wall`}
              highlight
            />
            {calc.totalWeight !== null && (
              <ResultCard
                label={`Total Weight (${runLength} ft)`}
                value={`${calc.totalWeight.toFixed(1)} lb`}
                subValue={`${(calc.totalWeight / 2000).toFixed(3)} tons`}
              />
            )}
          </div>
        ) : (
          <p className="text-xs text-surface-500 italic">
            Enter pipe dimensions to calculate weight.
          </p>
        )}
      </div>

      {/* ── Section: Barlow's Formula ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-700 pb-2">
          <Gauge className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-surface-200">Barlow&apos;s Formula — Min Wall Thickness</h3>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-800 border border-surface-700">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-surface-400">
            Wall<sub>min</sub> = (P × OD) ÷ (2SE + 2YP) per ASME B31.3.
            SE = {calc?.SE?.toLocaleString() ?? '—'} psi for {MATERIAL_LABELS[material]}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Design Pressure (psig)</label>
            <input
              type="number" step="1" min="0"
              value={pressure}
              onChange={e => setPressure(e.target.value)}
              placeholder="e.g. 150"
              className="input font-mono"
            />
          </div>
          <div>
            <label className="label">Weld Joint / Y Factor</label>
            <select
              value={yieldFactor}
              onChange={e => setYieldFactor(e.target.value)}
              className="input"
            >
              <option value="0.4">0.4 — Ferrite steel &lt;900°F</option>
              <option value="0.5">0.5 — Austenitic 900–950°F</option>
              <option value="0.7">0.7 — Austenitic &gt;950°F</option>
            </select>
          </div>
        </div>

        {calc?.minWall != null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ResultCard
              label="Minimum Wall Required"
              value={`${calc.minWall.toFixed(4)}&quot;`}
              subValue={`At ${pressure} psig design pressure`}
              highlight
            />
            <ResultCard
              label="Actual Wall Adequacy"
              value={calc.wallAdequate ? '✓ Adequate' : '✗ Undersized'}
              subValue={`Actual: ${wall.toFixed(4)}" | Min: ${calc.minWall.toFixed(4)}"`}
            />
          </div>
        ) : (
          <p className="text-xs text-surface-500 italic">
            Enter design pressure to check wall adequacy.
          </p>
        )}
      </div>
    </div>
  )
}
