'use client'
// ============================================================
// ISO Tap-to-Calculate — Step 4 (optional): Fitting Selection
// ============================================================
// "Skip (geometry only)" always available.
// BW: two fitting specs + gaps (confirmed; zero must be explicit)
// Threaded: two fitting specs + project-entered engagement
// No fabricated data — shows "no verified data" when catalog empty.
// ============================================================
import React, { useState } from 'react'
import { computeBwCutLength } from '../engines/bw-strategy'
import { computeThreadedCutLength } from '../engines/threaded-strategy'
import type { BwResult, BwError, ThreadedResult, ThreadedError, EngagementRecord } from '../engines/schemas'
import { dualFormat } from '@/lib/field-mode/calc/types'

export type ConnectionStrategy = 'bw' | 'threaded'

interface FittingSelectStepProps {
  travelMm: number
  onResult: (result: BwResult | ThreadedResult) => void
  onSkip: () => void
  onBack: () => void
}

// ── Butt-weld ──────────────────────────────────────────────

function BwForm({ travelMm, onResult }: { travelMm: number; onResult: (r: BwResult) => void }) {
  const [deductA, setDeductA]   = useState('')
  const [deductB, setDeductB]   = useState('')
  const [gapA,    setGapA]      = useState('')
  const [gapB,    setGapB]      = useState('')
  const [gapAConf, setGapAConf] = useState(false)
  const [gapBConf, setGapBConf] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [result, setResult]     = useState<BwResult | null>(null)

  // Note: all 166 BW rows are unverified (verified=false) — cut length unavailable.
  const noVerifiedData = true

  function compute() {
    setError(null)
    const dA = parseFloat(deductA)
    const dB = parseFloat(deductB)
    const gA = parseFloat(gapA) || 0
    const gB = parseFloat(gapB) || 0

    if (!gapAConf || !gapBConf) { setError('Both root gaps must be confirmed (including zero)'); return }

    const r: BwResult | BwError = computeBwCutLength({
      travel: travelMm,
      fittingA: { deductionMm: dA, verified: false, sourceDoc: 'project-entered', nominalSizeNps: '', angleDeg: 0 },
      fittingB: { deductionMm: dB, verified: false, sourceDoc: 'project-entered', nominalSizeNps: '', angleDeg: 0 },
      gapA: { valueMm: gA, confirmed: gapAConf },
      gapB: { valueMm: gB, confirmed: gapBConf },
    })
    if (r.kind === 'bw-error') { setError(r.reason); return }
    setResult(r)
    onResult(r)
  }

  return (
    <div className="flex flex-col gap-3">
      {noVerifiedData && (
        <div className="bg-amber-950/30 border border-amber-700 rounded-xl p-3">
          <p className="text-amber-400 text-sm font-medium">No verified fitting data</p>
          <p className="text-amber-300 text-xs mt-1">
            All BW fitting rows are sourced from an unverified AI recall and cannot be used for cut length.
            Enter your own deductions from a verified source (e.g. ASME B16.9 tables).
          </p>
        </div>
      )}

      {(['A', 'B'] as const).map((end, i) => {
        const dStr = i === 0 ? deductA : deductB
        const setD = i === 0 ? setDeductA : setDeductB
        const gStr = i === 0 ? gapA : gapB
        const setG = i === 0 ? setGapA : setGapB
        const gConf = i === 0 ? gapAConf : gapBConf
        const setGConf = i === 0 ? setGapAConf : setGapBConf

        return (
          <div key={end} className="bg-surface-900 border border-surface-700 rounded-xl p-3 flex flex-col gap-2">
            <span className="text-surface-300 text-sm font-semibold">Fitting {end}</span>
            <label className="block text-xs text-surface-400 uppercase tracking-wide">Deduction A{end} (mm)</label>
            <input
              type="number" min="0" step="0.1"
              value={dStr} onChange={e => setD(e.target.value)}
              placeholder="e.g. 100"
              className="min-h-[56px] px-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 font-mono"
            />
            <label className="block text-xs text-surface-400 uppercase tracking-wide">Root gap g{end} (mm)</label>
            <input
              type="number" min="0" step="0.5"
              value={gStr} onChange={e => { setG(e.target.value); setGConf(false) }}
              placeholder="e.g. 3 (enter 0 to confirm zero gap)"
              className="min-h-[56px] px-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 font-mono"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={gConf}
                onChange={e => setGConf(e.target.checked)}
                className="w-5 h-5 rounded accent-blue-600"
              />
              <span className="text-surface-300 text-sm">Confirm gap (including if zero)</span>
            </label>
          </div>
        )
      })}

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
      {result && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-3">
          <p className="text-surface-400 text-xs uppercase tracking-wide mb-1">Cut Length</p>
          <p className="text-surface-100 font-mono text-lg">{dualFormat(result.cutLengthMm).imperial}</p>
          <p className="text-blue-400 font-mono text-sm">{dualFormat(result.cutLengthMm).metric}</p>
        </div>
      )}

      <button
        type="button" onClick={compute}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold"
      >
        Compute Cut Length
      </button>
    </div>
  )
}

// ── Threaded NPT ──────────────────────────────────────────

function ThreadedForm({ travelMm, onResult }: { travelMm: number; onResult: (r: ThreadedResult) => void }) {
  const [f1Str, setF1]   = useState('')
  const [f2Str, setF2]   = useState('')
  const [e1Str, setE1]   = useState('')
  const [e2Str, setE2]   = useState('')
  const [eMin1, setEMin1] = useState('')
  const [eMax1, setEMax1] = useState('')
  const [eMin2, setEMin2] = useState('')
  const [eMax2, setEMax2] = useState('')
  const [source1, setSource1] = useState('')
  const [source2, setSource2] = useState('')
  const [e1Conf, setE1Conf]   = useState(false)
  const [e2Conf, setE2Conf]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [result, setResult]   = useState<ThreadedResult | null>(null)

  function makeEngagement(
    valueStr: string, minStr: string, maxStr: string, source: string, confirmed: boolean,
  ): EngagementRecord | null {
    const v = parseFloat(valueStr)
    const mn = parseFloat(minStr)
    const mx = parseFloat(maxStr)
    if (isNaN(v) || isNaN(mn) || isNaN(mx) || !source.trim()) return null
    return {
      basis: 'project-entered',
      valueMm: v, rangeMinMm: mn, rangeMaxMm: mx,
      sourceDescription: source.trim(),
      confirmedByUser: confirmed,
      confirmedAt: new Date().toISOString(),
    }
  }

  function compute() {
    setError(null)
    const f1 = parseFloat(f1Str)
    const f2 = parseFloat(f2Str)
    const eng1 = makeEngagement(e1Str, eMin1, eMax1, source1, e1Conf)
    const eng2 = makeEngagement(e2Str, eMin2, eMax2, source2, e2Conf)

    if (!eng1) { setError('Fitting 1: fill engagement value, range, and source, then confirm'); return }
    if (!eng2) { setError('Fitting 2: fill engagement value, range, and source, then confirm'); return }

    const makeSpec = (fDist: number, eng: EngagementRecord) => ({
      threadFamily: 'NPT' as const,
      nominalSizeNps: '',
      angleDeg: 45,
      faceDistanceMm: fDist,
      faceDistanceVerified: false,
      faceDistanceSource: 'project-entered',
      engagement: eng,
    })

    const r: ThreadedResult | ThreadedError = computeThreadedCutLength({
      inputMode: 'offset-derived-c',
      c: travelMm,
      fitting1: makeSpec(f1, eng1),
      fitting2: makeSpec(f2, eng2),
    })

    if (r.kind === 'threaded-error') { setError(r.reason); return }
    setResult(r)
    onResult(r)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-amber-950/30 border border-amber-700 rounded-xl p-3">
        <p className="text-amber-400 text-sm font-medium">Route 2 — Project-entered values</p>
        <p className="text-amber-300 text-xs mt-1">
          No verified engagement catalog exists. Enter dimensions and engagement from a named
          manufacturer reference or documented measured assembly. These values are labelled
          &ldquo;Project-entered values&rdquo; and never enter the shared catalog.
        </p>
      </div>

      {([1, 2] as const).map(n => {
        const fStr  = n === 1 ? f1Str  : f2Str
        const setF  = n === 1 ? setF1  : setF2
        const eStr  = n === 1 ? e1Str  : e2Str
        const setE  = n === 1 ? setE1  : setE2
        const minS  = n === 1 ? eMin1  : eMin2
        const setMin = n === 1 ? setEMin1 : setEMin2
        const maxS  = n === 1 ? eMax1  : eMax2
        const setMax = n === 1 ? setEMax1 : setEMax2
        const src   = n === 1 ? source1 : source2
        const setSrc = n === 1 ? setSource1 : setSource2
        const eConf = n === 1 ? e1Conf : e2Conf
        const setEConf = n === 1 ? setE1Conf : setE2Conf

        return (
          <div key={n} className="bg-surface-900 border border-surface-700 rounded-xl p-3 flex flex-col gap-2">
            <span className="text-surface-300 text-sm font-semibold">Fitting {n}</span>

            <label className="text-xs text-surface-400 uppercase tracking-wide">Centre-to-face F{n} (mm)</label>
            <input type="number" min="0" step="0.1" value={fStr} onChange={e => setF(e.target.value)}
              placeholder="e.g. 40"
              className="min-h-[56px] px-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 font-mono" />

            <label className="text-xs text-surface-400 uppercase tracking-wide">Insertion depth E{n} (mm)</label>
            <input type="number" min="0" step="0.1" value={eStr} onChange={e => { setE(e.target.value); setEConf(false) }}
              placeholder="e.g. 12"
              className="min-h-[56px] px-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 font-mono" />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-surface-400 uppercase tracking-wide">Emin</label>
                <input type="number" min="0" step="0.1" value={minS} onChange={e => setMin(e.target.value)}
                  placeholder="e.g. 11"
                  className="w-full min-h-[56px] px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 font-mono" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-surface-400 uppercase tracking-wide">Emax</label>
                <input type="number" min="0" step="0.1" value={maxS} onChange={e => setMax(e.target.value)}
                  placeholder="e.g. 13"
                  className="w-full min-h-[56px] px-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 font-mono" />
              </div>
            </div>

            <label className="text-xs text-surface-400 uppercase tracking-wide">Source (manufacturer ref or measured assembly)</label>
            <input type="text" value={src} onChange={e => setSrc(e.target.value)}
              placeholder="e.g. Anvil 300# 90-elbow, measured 2024-10-01"
              className="min-h-[56px] px-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm" />

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={eConf} onChange={e => setEConf(e.target.checked)}
                className="w-5 h-5 rounded accent-blue-600" />
              <span className="text-surface-300 text-sm">Confirm engagement values for fitting {n}</span>
            </label>
          </div>
        )
      })}

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      {result && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-3 flex flex-col gap-1">
          <p className="text-surface-400 text-xs uppercase tracking-wide">Cut Length (finished end-to-end incl. inserted ends)</p>
          {result.cutLengthMm != null ? (
            <>
              <p className="text-surface-100 font-mono text-lg">{dualFormat(result.cutLengthMm).imperial}</p>
              <p className="text-blue-400 font-mono text-sm">{dualFormat(result.cutLengthMm).metric}</p>
            </>
          ) : (
            <p className="text-amber-400 text-sm">Target engagement not confirmed — showing range only</p>
          )}
          <p className="text-surface-400 text-xs">
            Range: {dualFormat(result.cutLengthRangeMm[0]).metric} – {dualFormat(result.cutLengthRangeMm[1]).metric}
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-amber-300 text-xs">⚠ {w}</p>
          ))}
        </div>
      )}

      <button
        type="button" onClick={compute}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold"
      >
        Compute Cut Length
      </button>
    </div>
  )
}

// ── Main step ─────────────────────────────────────────────

export function FittingSelectStep({ travelMm, onResult, onSkip, onBack }: FittingSelectStepProps) {
  const [strategy, setStrategy] = useState<ConnectionStrategy>('bw')

  function handleBwResult(r: BwResult) { onResult(r) }
  function handleThreadedResult(r: ThreadedResult) { onResult(r) }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-surface-400 text-sm">
        Optional: add fitting data to compute a cut length.
        Travel: <span className="text-surface-200 font-mono">{dualFormat(travelMm).imperial} · {dualFormat(travelMm).metric}</span>
      </p>

      {/* Strategy toggle */}
      <div className="flex gap-2">
        {(['bw', 'threaded'] as const).map(s => (
          <button key={s} type="button"
            onClick={() => setStrategy(s)}
            className={`min-h-[56px] flex-1 rounded-xl border font-semibold text-sm ${strategy === s ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200'}`}>
            {s === 'bw' ? 'Butt-Weld' : 'Threaded NPT'}
          </button>
        ))}
      </div>

      {strategy === 'bw'
        ? <BwForm travelMm={travelMm} onResult={handleBwResult} />
        : <ThreadedForm travelMm={travelMm} onResult={handleThreadedResult} />
      }

      <button
        type="button" onClick={onSkip}
        className="min-h-[56px] rounded-xl bg-surface-800 text-surface-400 text-sm font-medium"
      >
        Skip — geometry only
      </button>
      <button
        type="button" onClick={onBack}
        className="min-h-[56px] rounded-xl bg-surface-800 text-surface-400 text-sm font-medium"
      >
        ← Back
      </button>
    </div>
  )
}
