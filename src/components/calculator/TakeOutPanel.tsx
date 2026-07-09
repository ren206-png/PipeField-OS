// ============================================================
// TakeOutPanel — Take-Out & Pipe Cut Length Calculator
// The core fitting calculator.
// ============================================================
'use client'

import { useState } from 'react'
import { ChevronDown, Scissors, RotateCcw, Plus, X } from 'lucide-react'
import {
  FITTING_TYPES, WELD_GAP_OPTIONS,
  type FittingType, type NpsSize, type WeldGapOption,
} from '@/config/pipe-data'
import {
  calculateTakeOut,
  parseFraction,
  toFeetInches,
  roundToSixteenth,
  formatInches,
} from '@/lib/calculator/pipe-calculations'
import { ResultCard } from './ResultCard'
import { WarningBanner } from './WarningBanner'

// ── Helpers ───────────────────────────────────────────────────
function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fit-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Returns the parsed, clamped quantity for a row.
// blank / NaN / negative / non-finite → 0; decimals → floored integer.
function parseQuantity(raw: string): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ── Types ─────────────────────────────────────────────────────
interface FittingRow {
  id: string
  type: FittingType | ''
  quantity: string
  customCtf: string   // only used when type === 'custom'
}

interface TakeOutPanelProps {
  nps: NpsSize
}

export function TakeOutPanel({ nps }: TakeOutPanelProps) {
  const [fittings, setFittings] = useState<FittingRow[]>(() => [
    { id: makeId(), type: '', quantity: '1', customCtf: '' },
  ])
  const [weldGapOpt, setWeldGapOpt]     = useState<WeldGapOption>('1/8')
  const [customGap, setCustomGap]       = useState('')
  const [totalRun, setTotalRun]         = useState('')
  const [totalRunUnit, setTotalRunUnit] = useState<'inches' | 'feet'>('inches')

  // Resolve weld gap — UNCHANGED from original
  const weldGapInches: number = (() => {
    if (weldGapOpt === 'custom') return parseFloat(customGap) || 0
    return WELD_GAP_OPTIONS.find(o => o.value === weldGapOpt)?.inches ?? 0.125
  })()

  // Per-row take-out results (parallel array to fittings)
  const rowResults = fittings.map(row => {
    if (!row.type) return { centerToFace: 0, takeOut: 0, takeOutPerFitting: 0, warnings: [] as string[] }
    return calculateTakeOut({
      nps,
      fittingType: row.type as FittingType,
      weldGapInches,
      customCTF: row.type === 'custom' ? parseFloat(row.customCtf) || undefined : undefined,
    })
  })

  // Σ (centerToFace × quantity) across all rows
  const totalFittingTakeout = fittings.reduce((sum, row, i) => {
    return sum + rowResults[i].centerToFace * parseQuantity(row.quantity)
  }, 0)

  // Total number of individual fittings (for weld gap count)
  const totalFittingCount = fittings.reduce((sum, row) => {
    if (!row.type) return sum
    return sum + parseQuantity(row.quantity)
  }, 0)

  // Resolve total run in inches — UNCHANGED from original
  const totalRunRaw = totalRun.trim()
  let totalRunInches = 0
  if (totalRunRaw) {
    const parsed = parseFraction(totalRunRaw)
    if (parsed !== null) {
      totalRunInches = totalRunUnit === 'feet' ? parsed * 12 : parsed
    }
  }

  const totalWeldGap       = totalFittingCount * weldGapInches
  const cutLengthInches    = totalRunInches - totalFittingTakeout + totalWeldGap
  const hasCutResult       = totalRunInches > 0
  const takeoutExceedsRun  = hasCutResult && totalFittingTakeout > totalRunInches

  const allWarnings = rowResults.flatMap(r => r.warnings)

  // ── Row mutators (all immutable) ──────────────────────────────
  function addRow() {
    setFittings(prev => [...prev, { id: makeId(), type: '', quantity: '1', customCtf: '' }])
  }

  function removeRow(id: string) {
    setFittings(prev => {
      if (prev.length <= 1) return [{ id: makeId(), type: '', quantity: '1', customCtf: '' }]
      return prev.filter(r => r.id !== id)
    })
  }

  function updateRow(id: string, patch: Partial<Pick<FittingRow, 'type' | 'quantity' | 'customCtf'>>) {
    setFittings(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function reset() {
    setFittings([{ id: makeId(), type: '', quantity: '1', customCtf: '' }])
    setTotalRun('')
    setCustomGap('')
  }

  return (
    <div className="space-y-6">
      {/* Fitting Rows */}
      <div className="space-y-3">
        <p className="label mb-0">Fittings</p>

        {fittings.map((row, i) => (
          <div key={row.id} className="space-y-2">
            <div className="flex gap-2 items-start">
              {/* Type select — populated from existing FITTING_TYPES constant */}
              <div className="relative flex-1">
                <select
                  value={row.type}
                  onChange={e => updateRow(row.id, { type: e.target.value as FittingType | '' })}
                  className="input appearance-none pr-10 cursor-pointer"
                >
                  <option value="">— Select fitting —</option>
                  {FITTING_TYPES.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
              </div>

              {/* Quantity */}
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={row.quantity}
                onChange={e => updateRow(row.id, { quantity: e.target.value })}
                className="input font-mono w-20 flex-shrink-0"
                aria-label="Quantity"
              />

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label="Remove fitting row"
                className="p-2.5 rounded-lg bg-surface-700 text-surface-400 hover:bg-surface-600 hover:text-surface-200 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Custom CTF input — only when type is 'custom' */}
            {row.type === 'custom' && (
              <div className="pl-0">
                <label className="label">Custom Center-to-Face (inches)</label>
                <input
                  type="number" step="0.0625" min="0"
                  placeholder='e.g. 6.000"'
                  value={row.customCtf}
                  onChange={e => updateRow(row.id, { customCtf: e.target.value })}
                  className="input font-mono"
                />
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="btn-ghost text-xs gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Fitting
        </button>
      </div>

      {/* Weld Gap — UNCHANGED from original */}
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

      {/* Take-out results per row */}
      {fittings.some(r => r.type) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Take-Out Results
          </p>
          <div className="grid grid-cols-2 gap-3">
            {fittings.map((row, i) => {
              if (!row.type) return null
              const res = rowResults[i]
              const qty = parseQuantity(row.quantity)
              const shortLabel = FITTING_TYPES.find(f => f.value === row.type)?.shortLabel ?? row.type
              return (
                <ResultCard
                  key={row.id}
                  label={`${shortLabel} ×${qty}`}
                  value={res.centerToFace > 0 ? formatInches(res.centerToFace * qty, 4) : '—'}
                  subValue={res.centerToFace > 0 ? `${formatInches(res.centerToFace, 4)} each` : undefined}
                  highlight={i === 0}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Total Run Input → Pipe Cut Length — display format UNCHANGED */}
      <div className="space-y-3 pt-2 border-t border-surface-700">
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5" />
          Pipe Cut Length
        </p>

        <div>
          <label className="label">
            Total Run Length
            <span className="ml-1 text-surface-500 font-normal normal-case">(center-to-center or face-to-face dimension)</span>
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

        {hasCutResult && (
          <div className="space-y-3">
            {takeoutExceedsRun ? (
              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
                <p className="text-yellow-400 text-sm font-medium">
                  ⚠ Take-out exceeds center-to-center length — check your inputs.
                </p>
              </div>
            ) : (
              <>
                {/* Primary result — same format as original */}
                <ResultCard
                  label="PIPE CUT LENGTH"
                  value={toFeetInches(roundToSixteenth(Math.max(0, cutLengthInches)))}
                  subValue={`${cutLengthInches.toFixed(4)}" exact  |  rounded to nearest 1/16"`}
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
                    value={formatInches(totalFittingTakeout, 4)}
                  />
                  <ResultCard
                    label="Total Weld Gap"
                    value={formatInches(totalWeldGap, 4)}
                  />
                </div>

                {/* Formula display — same style as original */}
                <div className="rounded-xl bg-surface-900 border border-surface-700 p-4 font-mono text-xs text-surface-400 space-y-1">
                  <p className="text-surface-300 font-semibold mb-2">Calculation:</p>
                  <p>Run = {totalRunInches.toFixed(4)}&quot;</p>
                  {fittings.map((row, i) => {
                    if (!row.type) return null
                    const res = rowResults[i]
                    const qty = parseQuantity(row.quantity)
                    const shortLabel = FITTING_TYPES.find(f => f.value === row.type)?.shortLabel ?? row.type
                    return (
                      <p key={row.id}>
                        - {shortLabel} ×{qty} = {formatInches(res.centerToFace * qty, 4)}&quot;
                      </p>
                    )
                  })}
                  {totalFittingCount > 0 && (
                    <p>+ Weld Gaps ({totalFittingCount}×) = {totalWeldGap.toFixed(4)}&quot;</p>
                  )}
                  <div className="border-t border-surface-700 pt-1 mt-1">
                    <p className="text-surface-100 font-semibold">
                      = Cut Length = {cutLengthInches.toFixed(4)}&quot;
                    </p>
                  </div>
                </div>
              </>
            )}
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
