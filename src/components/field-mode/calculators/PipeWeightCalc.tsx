'use client'
// Pipe Weight — weight per foot using material density
import React, { useState } from 'react'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { fromFeetInchesFraction, formatLength } from '@/lib/field-mode/calc/types'
import { createSupabaseReferenceAdapter } from '@/lib/field-mode/reference-adapter'
import type { DisplayOpts } from '@/lib/field-mode/calc/types'

const MATERIALS = ['Carbon Steel', 'Stainless 304', 'Stainless 316', 'Aluminum', 'Copper']

interface Props { displayOpts?: DisplayOpts }

export function PipeWeightCalc({ displayOpts = { unit: 'imperial', precision: '1/16' } }: Props) {
  const t = useFieldStrings('en')
  const [odStr, setOdStr]       = useState('')
  const [wtStr, setWtStr]       = useState('')
  const [lengthStr, setLengthStr] = useState('')
  const [material, setMaterial] = useState('Carbon Steel')
  const [result, setResult]     = useState<{ perFoot: string; total: string } | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function compute() {
    setError(null); setLoading(true); setUnverified(false)
    try {
      // Weight formula: W = 10.68 × t × (OD - t) lb/ft (for steel)
      // For other materials, adjust by density ratio
      const adapter = createSupabaseReferenceAdapter()
      const rows = await adapter.getMaterialWeight({ material })
      if (!rows.length) { setError(t.calc_missing_ref('ref_material_weights')); return }
      const row = rows[0]
      if (!row.verified) setUnverified(true)
      const densityLbFt3 = row.data.density_lb_per_ft3 ?? 490 // default steel
      const od = parseFloat(odStr)
      const wt = parseFloat(wtStr)
      const length = parseFloat(lengthStr) || 1
      if (isNaN(od) || isNaN(wt)) { setError('Enter OD and wall thickness in inches'); return }
      // Cross-sectional area in ft²
      const areaIn2 = Math.PI * ((od / 2) ** 2 - ((od / 2 - wt) ** 2))
      const areaFt2 = areaIn2 / 144
      const perFoot = areaFt2 * densityLbFt3
      const total = perFoot * length
      setResult({
        perFoot: `${perFoot.toFixed(2)} lb/ft`,
        total:   `${total.toFixed(2)} lb`,
      })
    } catch { setError('Check input') } finally { setLoading(false) }
  }

  function NumberInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">{label}</label>
        <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono"
          inputMode="decimal" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Material</label>
        <select value={material} onChange={e => setMaterial(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
          {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <NumberInput label="OD (in)" value={odStr} onChange={setOdStr} placeholder="e.g. 4.5" />
      <NumberInput label="Wall Thickness (in)" value={wtStr} onChange={setWtStr} placeholder="e.g. 0.237" />
      <NumberInput label="Length (ft)" value={lengthStr} onChange={setLengthStr} placeholder="e.g. 20" />
      <button type="button" onClick={compute} disabled={loading}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-60">
        {loading ? 'Looking up…' : 'Calculate'}
      </button>
      {unverified && <div className="px-3 py-2 rounded-lg bg-amber-900/40 text-amber-300 text-sm">{t.calc_unverified_badge}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex flex-col gap-2">
          <div className="flex justify-between"><span className="text-surface-400 text-sm">PER FOOT</span><span className="text-surface-100 font-mono text-lg">{result.perFoot}</span></div>
          <div className="flex justify-between"><span className="text-surface-400 text-sm">TOTAL</span><span className="text-surface-100 font-mono text-lg">{result.total}</span></div>
        </div>
      )}
    </div>
  )
}
