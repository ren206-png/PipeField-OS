'use client'
// Branch Layout — ordinate marks for branch saddle cut
import React, { useState } from 'react'
import { BranchDiagram } from '@/components/field-mode/diagrams/BranchDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { fromFeetInchesFraction, formatLength } from '@/lib/field-mode/calc/types'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

// For a 90° branch: ordinate at station x = sqrt(R² - (R - x)²) for saddle layout
// R = header OD / 2, r = branch OD / 2
// ordinates at 16 stations across branch diameter

interface Props { displayOpts?: DisplayOpts }

export function BranchLayoutCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const [headerOdStr, setHeaderOdStr] = useState('')
  const [branchOdStr, setBranchOdStr] = useState('')
  const [activeField, setActive]      = useState<'header' | 'branch' | null>(null)
  const [ordinates, setOrdinates]     = useState<string[] | null>(null)
  const [error, setError]             = useState<string | null>(null)

  function compute() {
    setError(null)
    try {
      const headerOd = fromFeetInchesFraction(headerOdStr)
      const branchOd = fromFeetInchesFraction(branchOdStr)
      const R = headerOd._mm / 2
      const r = branchOd._mm / 2
      if (r >= R) { setError('Branch OD must be smaller than header OD'); return }
      // 8 stations from CL to edge
      const results: string[] = []
      for (let i = 0; i <= 8; i++) {
        const x = (r * i) / 8
        const ordMm = Math.sqrt(R * R - x * x) - Math.sqrt(R * R - r * r)
        results.push(formatLength({ _mm: ordMm } as ReturnType<typeof fromFeetInchesFraction>, displayOpts))
      }
      setOrdinates(results)
    } catch { setError('Check input') }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <BranchDiagram />
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Header OD</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive('header')}>
          {headerOdStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {activeField === 'header' && <FractionKeypad value={headerOdStr} onChange={setHeaderOdStr} onSubmit={(v) => { setHeaderOdStr(v); setActive(null) }} unit="imperial" />}
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Branch OD</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive('branch')}>
          {branchOdStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {activeField === 'branch' && <FractionKeypad value={branchOdStr} onChange={setBranchOdStr} onSubmit={(v) => { setBranchOdStr(v); setActive(null) }} unit="imperial" />}
      <button type="button" onClick={compute} className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base">Calculate Ordinates</button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {ordinates && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4">
          <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">Ordinates (CL → edge, 8 stations)</p>
          <div className="grid grid-cols-2 gap-1">
            {ordinates.map((o, i) => (
              <div key={i} className="flex justify-between text-sm font-mono">
                <span className="text-surface-500">S{i}</span>
                <span className="text-surface-100">{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
