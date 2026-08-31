'use client'
// Stud & Wrench lookup
import React, { useState } from 'react'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { createSupabaseReferenceAdapter } from '@/lib/field-mode/reference-adapter'

const NPS_OPTIONS = ['½','¾','1','1¼','1½','2','2½','3','4','6','8','10','12','14','16','18','20','24']
const CLASSES = [150, 300, 600, 900, 1500, 2500]

export function StudLookupCalc() {
  const t = useFieldStrings('en')
  const [nps, setNps] = useState('4')
  const [flangeClass, setFlangeClass] = useState(150)
  const [result, setResult] = useState<{ studs: number; dia: string; length: string; wrench: string } | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function compute() {
    setError(null); setLoading(true); setUnverified(false)
    try {
      const adapter = createSupabaseReferenceAdapter()
      const rows = await adapter.getStudBolt({ nps, flange_class: flangeClass })
      if (!rows.length) { setError(t.calc_missing_ref('ref_stud_bolts')); return }
      const row = rows[0]
      if (!row.verified) setUnverified(true)
      const d = row.data
      setResult({
        studs:  d.studs_per_flange ?? 0,
        dia:    d.stud_dia_in ?? '',
        length: d.stud_length_in ?? '',
        wrench: d.nut_wrench_size_heavy_hex_in ? `${d.nut_wrench_size_heavy_hex_in}"` : '—',
      })
    } catch { setError('Check input') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">NPS</label>
          <select value={nps} onChange={e => setNps(e.target.value)}
            className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
            {NPS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Class</label>
          <select value={flangeClass} onChange={e => setFlangeClass(Number(e.target.value))}
            className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <button type="button" onClick={compute} disabled={loading}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-60">
        {loading ? 'Looking up…' : 'Look up'}
      </button>
      {unverified && <div className="px-3 py-2 rounded-lg bg-amber-900/40 text-amber-300 text-sm">{t.calc_unverified_badge}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-4 flex flex-col gap-2">
          <div className="flex justify-between"><span className="text-surface-400 text-sm">STUDS / FLANGE</span><span className="text-surface-100 font-mono text-lg">{result.studs}</span></div>
          <div className="flex justify-between"><span className="text-surface-400 text-sm">STUD DIA</span><span className="text-surface-100 font-mono text-lg">{result.dia}"</span></div>
          <div className="flex justify-between"><span className="text-surface-400 text-sm">STUD LENGTH</span><span className="text-surface-100 font-mono text-lg">{result.length}"</span></div>
          <div className="flex justify-between"><span className="text-surface-400 text-sm">WRENCH SIZE</span><span className="text-surface-100 font-mono text-lg">{result.wrench}</span></div>
        </div>
      )}
    </div>
  )
}
