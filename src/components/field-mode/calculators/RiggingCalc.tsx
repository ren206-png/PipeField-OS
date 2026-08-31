'use client'
// Rigging Calculator — sling leg load from total load and angle
// RIGGING DISCLAIMER shown persistently on every render.
import React, { useState } from 'react'
import { RiggingDiagram } from '@/components/field-mode/diagrams/RiggingDiagram'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { createSupabaseReferenceAdapter } from '@/lib/field-mode/reference-adapter'

export function RiggingCalc() {
  const t = useFieldStrings('en')
  const [loadKg, setLoadKg]       = useState('')
  const [angleDeg, setAngleDeg]   = useState('')
  const [result, setResult]       = useState<{ legLoad: string; factor: string } | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)

  async function compute() {
    setError(null); setLoading(true); setUnverified(false)
    try {
      const load = parseFloat(loadKg)
      const angle = parseFloat(angleDeg)
      if (isNaN(load) || isNaN(angle)) { setError('Enter load and angle'); return }
      const adapter = createSupabaseReferenceAdapter()
      const rows = await adapter.getSlingLegFactor({ angle_from_horizontal_deg: angle })
      if (rows.length) {
        const row = rows[0]
        if (!row.verified) setUnverified(true)
        const factor = row.data.leg_load_multiplier
        const legLoadKg = (load / 2) * factor
        setResult({
          legLoad: `${legLoadKg.toFixed(1)} kg`,
          factor:  `${factor.toFixed(3)}`,
        })
      } else {
        // Fallback calculation: F = 1 / sin(θ_from_horiz)
        const rad = angle * Math.PI / 180
        const factor = 1 / Math.sin(rad)
        const legLoadKg = (load / 2) * factor
        setResult({
          legLoad: `${legLoadKg.toFixed(1)} kg (calc)`,
          factor:  `${factor.toFixed(3)} (calc — no ref row found)`,
        })
        setUnverified(true)
      }
    } catch { setError('Check input') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* RIGGING DISCLAIMER — persistent on every render */}
      <div className="px-4 py-3 rounded-xl bg-red-900/40 border border-red-700 text-red-300 text-sm font-medium">
        ⚠ {t.calc_rigging_disclaimer}
      </div>
      <RiggingDiagram />
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Total Load (kg)</label>
        <input type="number" value={loadKg} onChange={e => setLoadKg(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono"
          placeholder="e.g. 2500" inputMode="decimal" />
      </div>
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Sling Angle from Horizontal (°)</label>
        <input type="number" min="1" max="90" value={angleDeg} onChange={e => setAngleDeg(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono"
          placeholder="e.g. 60" inputMode="decimal" />
      </div>
      <button type="button" onClick={compute} disabled={loading}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-60">
        {loading ? 'Looking up…' : 'Calculate'}
      </button>
      {unverified && <div className="px-3 py-2 rounded-lg bg-amber-900/40 text-amber-300 text-sm">{t.calc_unverified_badge}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex flex-col gap-2">
          <div className="flex justify-between"><span className="text-surface-400 text-sm">LEG LOAD (per sling)</span><span className="text-surface-100 font-mono text-lg">{result.legLoad}</span></div>
          <div className="flex justify-between"><span className="text-surface-400 text-sm">LOAD FACTOR</span><span className="text-surface-100 font-mono text-base">{result.factor}</span></div>
        </div>
      )}
    </div>
  )
}
