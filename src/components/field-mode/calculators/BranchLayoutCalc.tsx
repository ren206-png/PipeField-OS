'use client'
// Branch Layout — fishmouth / lateral template ordinates for a branch cut
import React, { useState } from 'react'
import { BranchDiagram } from '@/components/field-mode/diagrams/BranchDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { fromFeetInchesFraction, dualFormat, toMm } from '@/lib/field-mode/calc/types'
import { branchLayout } from '@/lib/field-mode/calc/branch'

// Stations are equal divisions round the branch (wrap a tape and mark each
// "arc" distance). The ordinate is how far to cut back from the longest point.
const STATIONS = 16

type Row = { station: number; deg: number; arc: { imperial: string; metric: string }; ord: { imperial: string; metric: string } }

export function BranchLayoutCalc() {
  const [headerOdStr, setHeaderOdStr] = useState('')
  const [branchOdStr, setBranchOdStr] = useState('')
  const [angleDeg, setAngleDeg]       = useState(90)
  const [activeField, setActive]      = useState<'header' | 'branch' | null>(null)
  const [rows, setRows]               = useState<Row[] | null>(null)
  const [notes, setNotes]             = useState<string[]>([])
  const [error, setError]             = useState<string | null>(null)

  function compute(header = headerOdStr, branch = branchOdStr, angle = angleDeg) {
    setError(null)
    setRows(null)
    if (!header.trim() || !branch.trim()) return
    try {
      const res = branchLayout({
        header_od: fromFeetInchesFraction(header),
        branch_od: fromFeetInchesFraction(branch),
        branch_angle_deg: angle,
        ordinate_count: STATIONS,
      })
      if (!res.ok) {
        setError(res.error.kind === 'InvalidInput' ? `Check ${res.error.field.replace('_', ' ')}: ${res.error.reason}` : 'Check input')
        return
      }
      setNotes(res.value.notes)
      setRows(res.value.ordinates.slice(0, STATIONS).map((o, i) => ({
        station: i + 1,
        deg: o.station_deg,
        arc: dualFormat(toMm(o.arc)),
        ord: dualFormat(toMm(o.ordinate)),
      })))
    } catch { setError('Check input') }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <BranchDiagram />
      <div className="flex flex-wrap gap-2">
        {[90, 60, 45].map(a => (
          <button key={a} type="button" onClick={() => { setAngleDeg(a); if (rows) compute(headerOdStr, branchOdStr, a) }}
            className={`min-h-[56px] px-4 rounded-xl border text-sm font-semibold ${angleDeg === a ? 'bg-blue-700 border-blue-500 text-white' : 'bg-surface-800 border-surface-700 text-surface-200'}`}>
            {a === 90 ? '90° tee' : `${a}° lateral`}
          </button>
        ))}
      </div>
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
      {activeField === 'branch' && <FractionKeypad value={branchOdStr} onChange={setBranchOdStr} onSubmit={(v) => { setBranchOdStr(v); setActive(null); compute(headerOdStr, v) }} unit="imperial" />}
      <button type="button" onClick={() => compute()} className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base">Calculate Ordinates</button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {rows && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4">
          <p className="text-xs text-surface-400 mb-3">
            Draw a square line round the branch. Mark {STATIONS} equal stations by wrapping a tape
            (<span className="text-surface-200">mark at</span>), then measure the <span className="text-surface-200">cut-back</span> from
            the line at each station and join the points.{angleDeg !== 90 && ' Station 1 is the toe (inside of the angle).'}
          </p>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 text-sm font-mono">
            <span className="text-surface-500 text-xs uppercase">Stn</span>
            <span className="text-surface-500 text-xs uppercase text-right">Mark at</span>
            <span className="text-surface-500 text-xs uppercase text-right">Cut-back</span>
            {rows.map(r => (
              <React.Fragment key={r.station}>
                <span className="text-surface-400">{r.station}<span className="text-surface-600 text-xs"> {r.deg.toFixed(1).replace('.0', '')}°</span></span>
                <div className="text-right">
                  <div className="text-surface-300">{r.arc.imperial}</div>
                  <div className="text-blue-400/70 text-xs">{r.arc.metric}</div>
                </div>
                <div className="text-right">
                  <div className="text-surface-100">{r.ord.imperial}</div>
                  <div className="text-blue-400 text-xs">{r.ord.metric}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
          {notes.map(n => <p key={n} className="mt-3 text-amber-300 text-xs">⚠ {n}</p>)}
        </div>
      )}
    </div>
  )
}
