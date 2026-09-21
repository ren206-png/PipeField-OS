'use client'
// Cut Length — Butt Weld
// Fetches take-out from ref_bw_fittings via ReferenceAdapter
import { useState } from 'react'
import { CutLengthDiagram } from '@/components/field-mode/diagrams/CutLengthDiagram'
import { FractionKeypad } from '@/components/field-mode/FractionKeypad'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { fromFeetInchesFraction, dualFormat } from '@/lib/field-mode/calc/types'
import { createSupabaseReferenceAdapter } from '@/lib/field-mode/reference-adapter'
import type { RefRow } from '@/lib/field-mode/calc/types'
import type { BwFittingRow } from '@/lib/field-mode/calc/reference'

// DB stores NPS as '1/2', '1-1/4' etc.
const NPS_OPTIONS: { value: string; label: string }[] = [
  { value: '1/2',   label: '½"'   },
  { value: '3/4',   label: '¾"'   },
  { value: '1',     label: '1"'   },
  { value: '1-1/4', label: '1¼"'  },
  { value: '1-1/2', label: '1½"'  },
  { value: '2',     label: '2"'   },
  { value: '2-1/2', label: '2½"'  },
  { value: '3',     label: '3"'   },
  { value: '3-1/2', label: '3½"'  },
  { value: '4',     label: '4"'   },
  { value: '5',     label: '5"'   },
  { value: '6',     label: '6"'   },
  { value: '8',     label: '8"'   },
  { value: '10',    label: '10"'  },
  { value: '12',    label: '12"'  },
  { value: '14',    label: '14"'  },
  { value: '16',    label: '16"'  },
  { value: '18',    label: '18"'  },
  { value: '20',    label: '20"'  },
  { value: '22',    label: '22"'  },
  { value: '24',    label: '24"'  },
]
// DB fitting_type values → display labels
const FITTING_TYPES: { value: string; label: string }[] = [
  { value: 'LR90',           label: '90° LR'   },
  { value: 'SR90',           label: '90° SR'   },
  { value: 'LR45',           label: '45° LR'   },
  { value: 'LR180_RETURN_O', label: '180° LR (O)' },
  { value: 'LR180_RETURN_K', label: '180° LR (K)' },
  { value: 'TEE_EQUAL',      label: 'Tee (Equal)' },
  { value: 'REDUCER',        label: 'Reducer'  },
  { value: 'CAP',            label: 'Cap'      },
]

export function CutLengthBwCalc() {
  const t = useFieldStrings('en')
  const [ctcStr, setCtcStr] = useState('')
  const [nps, setNps] = useState('2')
  const [fittingType, setFittingType] = useState('LR90')
  const [active, setActive] = useState(false)
  const [result, setResult] = useState<{ imperial: string; metric: string } | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function compute() {
    setError(null); setLoading(true); setUnverified(false)
    try {
      const adapter = createSupabaseReferenceAdapter()
      const rows: RefRow<BwFittingRow>[] = await adapter.getBwFitting({ nps, fitting_type: fittingType })
      if (!rows.length) { setError(t.calc_missing_ref('ref_bw_fittings')); return }
      const row = rows[0]
      if (!row.verified) setUnverified(true)
      const ctc = fromFeetInchesFraction(ctcStr)
      const takeout = row.data.center_to_end_in ?? 0
      const cutMm = ctc._mm - 2 * takeout * 25.4
      setResult(dualFormat(cutMm))
    } catch (e) {
      setError('Check input')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <CutLengthDiagram />
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">NPS</label>
        <select value={nps} onChange={e => setNps(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
          {NPS_OPTIONS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Fitting Type</label>
        <select value={fittingType} onChange={e => setFittingType(e.target.value)}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base">
          {FITTING_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">Centre to Centre</label>
        <div className="min-h-[56px] px-4 py-3 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-lg font-mono cursor-text" onClick={() => setActive(true)}>
          {ctcStr || <span className="text-surface-600">tap…</span>}
        </div>
      </div>
      {active && <FractionKeypad value={ctcStr} onChange={setCtcStr} onSubmit={(v) => { setCtcStr(v); setActive(false) }} unit="imperial" />}
      <button type="button" onClick={compute} disabled={loading}
        className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-base disabled:opacity-60">
        {loading ? 'Looking up…' : 'Calculate'}
      </button>
      {unverified && <div className="px-3 py-2 rounded-lg bg-amber-900/40 text-amber-300 text-sm">{t.calc_unverified_badge}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="bg-surface-800 rounded-xl p-4 space-y-2 border border-surface-700">
          <div className="flex justify-between items-center">
            <span className="text-surface-400 text-sm">CUT LENGTH</span>
            <div className="text-right">
              <div className="text-surface-100 font-mono text-lg">{result.imperial}</div>
              <div className="text-blue-400 font-mono text-sm">{result.metric}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
