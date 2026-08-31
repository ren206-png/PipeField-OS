'use client'
// ============================================================
// Field Mode — Reference Verification Console
// Gate: PFOS_FIELD_REF_VERIFY_CONSOLE flag + platform_admin role.
//
// Phase 1 migration check: no `check_priority` column found in
// the migration — "pinned" rows are identified by `source_doc`
// containing batch report annotations, not a dedicated column.
// If a check_priority column is added in a future migration,
// update sortRows() to use it.
// ============================================================
import React, { useState, useCallback, useEffect } from 'react'
import { FLAGS } from '@/intelligence/flags'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { createClient } from '@/lib/supabase/client'

// All 41 ref tables (24 recall + 17 field-book)
const ALL_TABLES = [
  // Recall tables (24)
  'ref_flanges', 'ref_flange_hubs', 'ref_flange_weights', 'ref_stud_bolts',
  'ref_bw_fittings', 'ref_reducing_tee_outlets', 'ref_sw_fittings', 'ref_sw_couplings',
  'ref_threaded_fittings', 'ref_npt_threads', 'ref_wrench_sizes',
  'ref_shackles', 'ref_sling_leg_factors', 'ref_snatch_block_factors',
  'ref_wire_rope_slings', 'ref_synthetic_slings', 'ref_chain_slings',
  'ref_material_weights', 'ref_plate_steel_weights',
  // Field-book tables (17)
  'ref_hand_signals', 'ref_conversion_factors', 'ref_eye_bolts', 'ref_wire_rope_clips',
  'ref_hydro_test_pressures', 'ref_pancake_thickness', 'ref_valve_face_to_face',
  'ref_abbreviations', 'ref_formulas', 'ref_gas_properties', 'ref_water_head_pressure',
  'ref_bolt_drill_tap', 'ref_npt_threads',
  // Additional recall
  'ref_bolt_drill_tap',
]

// Deduplicate
const REF_TABLES = ALL_TABLES.filter((t, i) => ALL_TABLES.indexOf(t) === i)

interface RefRow {
  id: string
  verified: boolean | null
  recall_confidence: string | null
  rejected: boolean | null
  source_doc: string | null
  standard: string | null
  edition: string | null
  [key: string]: unknown
}

// Sort order per spec:
// 1. unverified + not computed
// 2. low confidence
// 3. medium confidence
// 4. unrated
// 5. high confidence
// 6. computed
// 7. verified=true (done)
function confidenceOrder(r: RefRow): number {
  if (r.verified === true)                      return 7
  if (r.recall_confidence === 'computed')       return 6
  if (r.recall_confidence === 'high')           return 5
  if (r.recall_confidence === 'unrated')        return 4
  if (r.recall_confidence === 'medium')         return 3
  if (r.recall_confidence === 'low')            return 2
  // unverified + not computed
  return 1
}

function sortRows(rows: RefRow[]): RefRow[] {
  return [...rows].sort((a, b) => confidenceOrder(a) - confidenceOrder(b))
}

export default function VerifyConsolePage() {
  const t = useFieldStrings('en')

  // Check flags inline — redirect if needed
  const [roleChecked, setRoleChecked] = useState(false)
  const [authorized, setAuthorized]   = useState(false)

  useEffect(() => {
    if (!FLAGS.PFOS_FIELD_REF_VERIFY_CONSOLE) {
      window.location.replace('/field/home')
      return
    }
    // Check role via Supabase session
    async function checkRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/login'); return }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (profile?.role === 'platform_admin') {
        setAuthorized(true)
      }
      setRoleChecked(true)
    }
    checkRole()
  }, [])

  const [selectedTable, setSelectedTable] = useState('')
  const [rows, setRows]                   = useState<RefRow[]>([])
  const [loading, setLoading]             = useState(false)
  const [selected, setSelected]           = useState<string[]>([])
  const [verifiedAgainst, setVerifiedAgainst] = useState<Record<string, string>>({})
  const [rejectNotes, setRejectNotes]     = useState<Record<string, string>>({})
  const [actionMsg, setActionMsg]         = useState<string | null>(null)

  const loadTable = useCallback(async (table: string) => {
    if (!table) return
    setLoading(true)
    setRows([])
    setSelected([])
    try {
      const supabase = createClient()
      const { data } = await supabase.from(table).select('*').limit(500)
      setRows(sortRows((data ?? []) as RefRow[]))
    } finally { setLoading(false) }
  }, [])

  async function submitVerify(rowIds: string[], reject: boolean, note?: string, against?: string) {
    const res = await fetch('/api/field/verify-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_name: selectedTable,
        row_ids: rowIds,
        verified: !reject,
        verified_against: against,
        note,
        reject,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setActionMsg(`Updated ${json.updated} rows`)
      loadTable(selectedTable)
    } else {
      setActionMsg(`Error: ${json.error}`)
    }
  }

  if (!roleChecked) return <div className="min-h-screen bg-surface-950 flex items-center justify-center"><p className="text-surface-400">Checking access…</p></div>
  if (!authorized) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-8">
      <p className="text-red-400 text-center">{t.err_unauthorized}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-surface-800">
        <h1 className="text-xl font-bold text-surface-100">{t.verify_title}</h1>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Table picker */}
        <select
          value={selectedTable}
          onChange={e => { setSelectedTable(e.target.value); loadTable(e.target.value) }}
          className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base"
        >
          <option value="">{t.verify_pick_table}</option>
          {REF_TABLES.map(tbl => <option key={tbl} value={tbl}>{tbl}</option>)}
        </select>

        {actionMsg && (
          <div className="px-4 py-3 rounded-xl bg-surface-800 text-surface-200 text-sm">{actionMsg}</div>
        )}

        {/* Bulk verify */}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => submitVerify(selected, false, undefined, 'bulk verify')}
            className="min-h-[56px] rounded-xl bg-green-700 text-white font-semibold text-sm"
          >
            {t.verify_bulk_label} ({selected.length})
          </button>
        )}

        {loading && <p className="text-surface-400 text-sm">Loading…</p>}

        {/* Rows */}
        <div className="flex flex-col gap-3">
          {rows.map(row => {
            const isSelected = selected.includes(row.id)
            return (
              <div key={row.id} className={`rounded-xl border p-3 ${isSelected ? 'border-blue-600 bg-blue-950/20' : 'border-surface-700 bg-surface-900'}`}>
                {/* Row header */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelected(prev => prev.includes(row.id) ? prev : [...prev, row.id])
                      } else {
                        setSelected(prev => prev.filter(id => id !== row.id))
                      }
                    }}
                    className="mt-1 w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="flex gap-1 flex-wrap mb-1">
                      {row.rejected && <span className="px-2 py-0.5 rounded-full bg-red-900 text-red-300 text-[10px] font-semibold">Rejected</span>}
                      {!row.verified && <span className="px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 text-[10px]">{t.verify_status_unverified}</span>}
                      {row.recall_confidence && (
                        <span className="px-2 py-0.5 rounded-full bg-surface-800 text-surface-400 text-[10px]">
                          {row.recall_confidence}
                        </span>
                      )}
                      {row.verified && <span className="px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 text-[10px]">Verified</span>}
                    </div>
                    <p className="text-surface-400 text-[10px] font-mono">{row.id.slice(0, 12)}…</p>
                    {row.source_doc && <p className="text-surface-500 text-[10px] mt-0.5">{row.source_doc}</p>}
                  </div>
                </div>

                {/* Verify action */}
                <div className="mt-2 flex flex-col gap-2">
                  <input
                    type="text"
                    value={verifiedAgainst[row.id] ?? ''}
                    onChange={e => setVerifiedAgainst(prev => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder={t.verify_against_placeholder}
                    className="min-h-[44px] w-full px-3 rounded-lg border bg-surface-800 border-surface-700 text-surface-100 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => submitVerify([row.id], false, undefined, verifiedAgainst[row.id])}
                      className="min-h-[44px] flex-1 rounded-lg bg-green-700 text-white text-sm font-semibold"
                    >
                      {t.verify_btn_verify}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const note = rejectNotes[row.id]
                        if (!note) { alert(t.verify_reject_note); return }
                        submitVerify([row.id], true, note)
                      }}
                      className="min-h-[44px] flex-1 rounded-lg bg-red-700 text-white text-sm font-semibold"
                    >
                      {t.verify_btn_reject}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rejectNotes[row.id] ?? ''}
                    onChange={e => setRejectNotes(prev => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder={t.verify_reject_note}
                    className="min-h-[44px] w-full px-3 rounded-lg border bg-surface-800 border-surface-700 text-surface-100 text-sm"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
