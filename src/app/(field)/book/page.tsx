'use client'
// ============================================================
// Field Mode — Reference Book
// Seven category cards linking to table lists.
// ============================================================
import React from 'react'
import Link from 'next/link'
import { useFieldStrings } from '@/lib/field-mode/locale'

interface Category {
  id: string
  label: string
  tables: string[]
  isRigging?: boolean
}

export default function BookPage() {
  const t = useFieldStrings('en')

  const CATEGORIES: Category[] = [
    {
      id: 'flanges',
      label: t.book_cat_flanges,
      tables: ['ref_flanges', 'ref_flange_hubs', 'ref_flange_weights', 'ref_stud_bolts'],
    },
    {
      id: 'fittings',
      label: t.book_cat_fittings,
      tables: ['ref_bw_fittings', 'ref_reducing_tee_outlets', 'ref_sw_fittings', 'ref_sw_couplings', 'ref_threaded_fittings'],
    },
    {
      id: 'rigging',
      label: t.book_cat_rigging,
      tables: ['ref_shackles', 'ref_sling_leg_factors', 'ref_snatch_block_factors', 'ref_wire_rope_slings', 'ref_synthetic_slings', 'ref_chain_slings'],
      isRigging: true,
    },
    {
      id: 'threads',
      label: t.book_cat_threads,
      tables: ['ref_npt_threads', 'ref_bolt_drill_tap', 'ref_wrench_sizes'],
    },
    {
      id: 'materials',
      label: t.book_cat_materials,
      tables: ['ref_material_weights', 'ref_plate_steel_weights'],
    },
    {
      id: 'gas',
      label: t.book_cat_gas,
      tables: ['ref_gas_properties', 'ref_water_head_pressure'],
    },
    {
      id: 'misc',
      label: t.book_cat_misc,
      tables: ['ref_hand_signals', 'ref_conversion_factors', 'ref_eye_bolts', 'ref_wire_rope_clips', 'ref_hydro_test_pressures', 'ref_pancake_thickness', 'ref_valve_face_to_face', 'ref_abbreviations', 'ref_formulas'],
    },
  ]

  return (
    <div className="min-h-screen bg-surface-950 p-4">
      <h1 className="text-xl font-bold text-surface-100 mb-6">{t.book_title}</h1>
      <div className="flex flex-col gap-3">
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="rounded-2xl border bg-surface-900 border-surface-700 overflow-hidden">
            {/* Category header */}
            <div className={`px-4 py-3 border-b border-surface-800 flex items-center justify-between ${cat.isRigging ? 'bg-red-950/40' : ''}`}>
              <span className="text-surface-100 font-semibold">
                {cat.isRigging && <span className="mr-1 text-red-400">⚠</span>}
                {cat.label}
              </span>
              <span className="text-surface-500 text-sm">{cat.tables.length} tables</span>
            </div>
            {/* Table links */}
            <div className="divide-y divide-surface-800">
              {cat.tables.map((table) => (
                <Link
                  key={table}
                  href={`/field/book/${table}`}
                  className="flex items-center justify-between px-4 py-3 min-h-[56px] active:bg-surface-800 transition-colors"
                >
                  <span className="text-surface-200 text-sm font-mono">{table.replace('ref_', '').replace(/_/g, ' ')}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Offline note */}
      <p className="mt-4 text-center text-surface-500 text-xs">{t.book_offline_note}</p>
    </div>
  )
}
