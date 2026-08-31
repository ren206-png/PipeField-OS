// ============================================================
// File -> table name mapping.
//
// Recall mapping is copied verbatim from the master prompt §3.2
// table. Do not edit without updating the prompt reference.
//
// Pocket-tradesman mapping: the master prompt names the 8 tables
// that exist ONLY in the book explicitly (§3.2b) — copied verbatim
// below. For the 9 remaining pocket files that cover the SAME
// subject as an existing recall table but with different columns
// (owner's field-book layout, not the recall layout), the prompt
// does not hand us a literal table name — only a behavior ("book
// wins", "import both keyed by X", "second signal set"). Forcing
// those rows into the recall table's own columns would violate
// "column names mirror the CSV headers exactly, never rename or
// normalize" (§3.2), since the two files' headers differ. So each
// gets its own table, named after the recall subject with a
// `_book` suffix, and the importer runs an explicit reconciliation
// pass (see precedence.ts) that marks the specific recall rows the
// cross-check document lists as `superseded_by_batch`, pointing at
// this table. This is a Phase 1 design decision, not a prompt
// requirement — flagged as such in PHASE_1 completion notes.
// ============================================================

export const RECALL_TABLE_MAP: Record<string, string> = {
  'ref_flanges_b16_5.csv': 'ref_flanges',
  'ref_flange_hubs_b16_5.csv': 'ref_flange_hubs',
  'ref_flange_weights_b16_5.csv': 'ref_flange_weights',
  'ref_stud_bolts_b16_5.csv': 'ref_stud_bolts',
  'ref_bw_fittings_b16_9.csv': 'ref_bw_fittings',
  'ref_reducing_tee_outlet_b16_9.csv': 'ref_reducing_tee_outlets',
  'ref_sw_fittings_b16_11.csv': 'ref_sw_fittings',
  'ref_sw_couplings_b16_11.csv': 'ref_sw_couplings',
  'ref_threaded_fittings_ctr_to_end.csv': 'ref_threaded_fittings',
  'ref_npt_threads_b1_20_1.csv': 'ref_npt_threads',
  'ref_bolt_drill_tap.csv': 'ref_bolt_drill_tap',
  'ref_wrench_sizes.csv': 'ref_wrench_sizes',
  'ref_shackles.csv': 'ref_shackles',
  'ref_sling_leg_factors.csv': 'ref_sling_leg_factors',
  'ref_snatch_block_factors.csv': 'ref_snatch_block_factors',
  'ref_wire_rope_sling_swl.csv': 'ref_wire_rope_slings',
  'ref_synthetic_sling_wll.csv': 'ref_synthetic_slings',
  'ref_chain_sling_wll.csv': 'ref_chain_slings',
  'ref_hand_signals.csv': 'ref_hand_signals',
  'ref_conversion_factors.csv': 'ref_conversion_factors',
  'ref_water_head_pressure.csv': 'ref_water_head_pressure',
  'ref_gas_properties.csv': 'ref_gas_properties',
  'ref_material_weights.csv': 'ref_material_weights',
  'ref_plate_steel_weights.csv': 'ref_plate_steel_weights',
}

export const POCKET_TABLE_MAP: Record<string, string> = {
  // §3.2b — named explicitly by the prompt (book-only, no recall counterpart)
  'ref_eye_bolts_pocket_tradesman.csv': 'ref_eye_bolts',
  'ref_fibre_rope_swl_pocket_tradesman.csv': 'ref_fibre_rope_slings',
  'ref_wire_rope_clips_pocket_tradesman.csv': 'ref_wire_rope_clips',
  'ref_hydro_test_pressures_pocket_tradesman.csv': 'ref_hydro_test_pressures',
  'ref_pancake_thickness_pocket_tradesman.csv': 'ref_pancake_thickness',
  'ref_valve_face_to_face_pocket_tradesman.csv': 'ref_valve_face_to_face',
  'ref_abbreviations_pocket_tradesman.csv': 'ref_abbreviations',
  'ref_formulas_pocket_tradesman.csv': 'ref_formulas',

  // Phase 1 design decision — overlaps an existing recall table but
  // keeps its own columns; reconciled against the recall table by
  // precedence.ts using the exact cells listed in
  // CROSS_CHECK_pocket_tradesman.md.
  'ref_chain_slings_pocket_tradesman.csv': 'ref_chain_slings_book',
  'ref_flange_bolting_pocket_tradesman.csv': 'ref_flange_bolting_book',
  'ref_material_weights_pocket_tradesman.csv': 'ref_material_weights_book',
  'ref_nylon_web_slings_pocket_tradesman.csv': 'ref_synthetic_slings_book',
  'ref_reducing_tee_outlet_pocket_tradesman.csv': 'ref_reducing_tee_outlets_book',
  'ref_shackles_pocket_tradesman.csv': 'ref_shackles_book',
  'ref_wire_rope_slings_pocket_tradesman.csv': 'ref_wire_rope_slings_book',
  'ref_wn_flange_lth_pocket_tradesman.csv': 'ref_wn_flange_lth_book',
  'ref_hand_signals_pocket_tradesman.csv': 'ref_hand_signals_book',
}

export function allFileTablePairs(): Array<{ file: string; table: string; source: 'recall' | 'pocket-tradesman' }> {
  return [
    ...Object.entries(RECALL_TABLE_MAP).map(([file, table]) => ({ file, table, source: 'recall' as const })),
    ...Object.entries(POCKET_TABLE_MAP).map(([file, table]) => ({ file, table, source: 'pocket-tradesman' as const })),
  ]
}
