// ============================================================
// Field Mode Locale — minimal key-value i18n
// next-intl is not installed (Phase 0 finding). Ship 'en' strings;
// fr-CA and es are keyed stubs.
// ============================================================

export type FieldLocale = 'en' | 'fr-CA' | 'es'

export type FieldStrings = typeof EN_STRINGS

const EN_STRINGS = {
  // Home
  home_today:           'Today',
  home_calc:            'Calc',
  home_book:            'Book',
  home_my_log:          'My Log',
  home_sync_synced:     'Synced',
  home_sync_queued:     (n: number) => `${n} queued`,
  home_sync_failed:     'Sync failed',

  // Calc
  calc_picker_title:    'Calculators',
  calc_simple_offset:   'Simple Offset',
  calc_rolling_offset:  'Rolling Offset',
  calc_parallel_offsets:'Parallel Offsets',
  calc_cut_bw:          'Cut Length — Butt Weld',
  calc_cut_sw:          'Cut Length — Socket Weld',
  calc_cut_threaded:    'Cut Length — Threaded',
  calc_odd_angle:       'Odd-Angle Cut from 90',
  calc_two_hole_flange: '2-Hole Flange',
  calc_branch_layout:   'Branch Layout',
  calc_miter:           'Miter',
  calc_pipe_weight:     'Pipe Weight',
  calc_rigging:         'Rigging',
  calc_stud_lookup:     'Stud & Wrench',
  calc_result_label:    'Result',
  calc_unverified_badge:'⚠ Unverified data',
  calc_rigging_disclaimer: 'Reference only. The tag, the manufacturer chart, and the site lift plan govern.',
  calc_assume_lr_label: 'Assume LR standard (result labelled ASSUMED)',
  calc_assumed_label:   'ASSUMED',
  calc_missing_ref:     (table: string) => `No data found in ${table}`,
  calc_input_ft:        'ft',
  calc_input_in:        'in',
  calc_input_mm:        'mm',
  calc_input_decimal:   '.',

  // Book
  book_title:           'Reference Book',
  book_search_placeholder: 'Search by NPS, class, or material…',
  book_cat_flanges:     'Flanges',
  book_cat_fittings:    'Fittings',
  book_cat_rigging:     'Rigging',
  book_cat_threads:     'Threads & Bolts',
  book_cat_materials:   'Materials & Weight',
  book_cat_gas:         'Gas & Fluids',
  book_cat_misc:        'Misc',
  book_unverified_badge:'Unverified',
  book_low_confidence:  'Check before use',
  book_rejected_badge:  'Rejected',
  book_source_footer:   (std: string, ed: string, doc: string) => `${std} ${ed} — ${doc}`,
  book_cache_date:      (d: string) => `Cached ${d}`,
  book_rigging_warning: 'Reference only. The tag, the manufacturer chart, and the site lift plan govern.',
  book_offline_note:    'Available offline',

  // Scan
  scan_title:           'Scan Spool Tag',
  scan_tap_to_scan:     'Tap to scan QR code',
  scan_invalid_qr:      'Invalid QR code',
  scan_wrong_tenant:    'This tag belongs to a different company',
  scan_joints_title:    'Joints',
  scan_tap_joint:       'Tap a joint to log it',
  scan_log_welded:      'Welded',
  scan_log_fitup:       'Fit-up',
  scan_confirm:         'Confirm',
  scan_undo:            'Undo',
  scan_undo_seconds:    (n: number) => `Undo (${n}s)`,
  scan_queued:          'Queued for sync',
  scan_wps_label:       'WPS',
  scan_heat_a_label:    'Heat A',
  scan_heat_b_label:    'Heat B',

  // Verify console
  verify_title:         'Reference Verification',
  verify_pick_table:    'Select table…',
  verify_btn_verify:    'Verify',
  verify_btn_reject:    'Reject',
  verify_against_placeholder: 'Source (e.g. Blue Book p.42)',
  verify_reject_note:   'Rejection note (required)',
  verify_bulk_label:    'Verify all filtered',
  verify_status_unverified: 'Unverified',
  verify_status_low:    'Low confidence',
  verify_status_medium: 'Medium confidence',
  verify_status_high:   'High confidence',
  verify_status_computed:'Computed',
  verify_status_unrated: 'Unrated',

  // Personal log
  log_title:              'My Log',
  log_empty:              'No entries yet. Logged welds and fit-ups will appear here.',
  log_entry_welded:       'Welded',
  log_entry_fitup:        'Fit-up',
  log_entry_note:         'Note',
  log_date_label:         'Date',
  log_project_label:      'Project',
  log_joint_label:        'Joint',
  log_process_label:      'Process',
  log_nde_label:          'NDE',
  log_nde_released:       'Released',
  log_nde_pending:        'Pending',
  log_nde_failed:         'Failed',
  log_correction_note:    'Correction — see entry',
  log_export_btn:         'Export My Log',
  log_export_pdf:         'PDF',
  log_export_csv:         'CSV',
  log_export_what_included: 'Includes: dates, project names, joint counts, process, NDE results released by QC. Does not include: client names, commercial data, other workers\' entries, pricing.',
  log_add_note_btn:       'Add Note',
  log_note_placeholder:   'Free-text note…',
  log_save_note:          'Save Note',
  log_cancel:             'Cancel',

  // Voice notes
  voice_title:            'Voice Note',
  voice_tap_to_record:    'Tap to record',
  voice_recording:        'Recording…',
  voice_transcribing:     'Transcribing…',
  voice_suggestion_title: 'Suggested Entry',
  voice_confirm_btn:      'Confirm & Add to Log',
  voice_discard_btn:      'Discard',
  voice_disclaimer:       'Review carefully — AI suggestions may contain errors.',
  voice_no_joint_found:   'No joint ID recognised — note only',

  // Errors
  err_flag_off:         'Field Mode is not enabled for your organisation',
  err_not_fitter:       'Field Mode is for pipefitters and shop fabricators',
  err_unauthorized:     'Not authorised',
} as const

// Stub records — will use EN until translated
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _FR_CA_STUBS: Record<keyof typeof EN_STRINGS, unknown> = {} as Record<keyof typeof EN_STRINGS, unknown>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ES_STUBS:   Record<keyof typeof EN_STRINGS, unknown> = {} as Record<keyof typeof EN_STRINGS, unknown>

const STRINGS: Record<FieldLocale, typeof EN_STRINGS> = {
  'en':    EN_STRINGS,
  'fr-CA': EN_STRINGS, // stub — will use EN until translated
  'es':    EN_STRINGS, // stub
}

export function useFieldStrings(locale: FieldLocale = 'en'): typeof EN_STRINGS {
  return STRINGS[locale] ?? EN_STRINGS
}

// Server-side helper (no React)
export function getFieldStrings(locale: FieldLocale = 'en'): typeof EN_STRINGS {
  return STRINGS[locale] ?? EN_STRINGS
}
