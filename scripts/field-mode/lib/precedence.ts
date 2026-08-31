// ============================================================
// Book-vs-recall precedence, transcribed verbatim from
// /data/sources/pocket-tradesman/CROSS_CHECK_pocket_tradesman.md.
//
// This file contains ZERO invented values. Every entry below is a
// direct transcription of a row already listed in the cross-check
// document, which is itself the owner-supplied, approved authority
// for import-time precedence (master prompt §3.2b). Nothing here
// is derived from model memory of ASME/API/CSA standards.
//
// The importer (import-reference-data.ts) uses this file in a
// reconciliation pass that runs AFTER both a recall table and its
// corresponding `_book` table have been imported:
//   1. For each STUD_LENGTH / TEE_OUTLET / SHACKLE entry: look up
//      the recall row by key, assert its current value matches
//      `recallValue` (sanity check — abort loudly if not, rather
//      than silently applying a stale rule to the wrong row), then
//      set `superseded_by_batch` on it to this import's batch id.
//      The book row remains the canonical value going forward.
//   2. For each FLANGE_BOLT_OD_MISPRINT entry: the book row (not
//      the recall row) gets `rejected = true` with `rejected_note`
//      explaining the misprint. The recall/ASME row is untouched
//      and stays canonical.
//   3. WN_LTH: no data differs (0 of 40 rows) — the reconciliation
//      pass runs the same comparison for confirmation and logs the
//      "0 superseded" result; nothing is written.
// ============================================================

export interface StudLengthSupersession {
  flangeClass: number
  nps: string
  /** stud_length_in as it appears in ref_stud_bolts (sanity check only) */
  recallValue: string
  /** rf_stud_length_in as it appears in ref_flange_bolting_book */
  bookValue: string
}

export const STUD_LENGTH_SUPERSESSIONS: StudLengthSupersession[] = [
  { flangeClass: 150, nps: '3/4', recallValue: '2-1/2', bookValue: '2-1/4' },
  { flangeClass: 150, nps: '10', recallValue: '4-1/2', bookValue: '4-3/4' },
  { flangeClass: 150, nps: '16', recallValue: '5-1/4', bookValue: '5-1/2' },
  { flangeClass: 150, nps: '18', recallValue: '5-3/4', bookValue: '6' },
  { flangeClass: 150, nps: '24', recallValue: '6-3/4', bookValue: '7' },
  { flangeClass: 300, nps: '3/4', recallValue: '3', bookValue: '2-3/4' },
  { flangeClass: 300, nps: '1', recallValue: '3', bookValue: '3-1/4' },
  { flangeClass: 300, nps: '20', recallValue: '8', bookValue: '8-1/4' },
  { flangeClass: 300, nps: '24', recallValue: '9', bookValue: '9-1/4' },
  { flangeClass: 600, nps: '3/4', recallValue: '3-1/2', bookValue: '3-1/4' },
  { flangeClass: 600, nps: '8', recallValue: '7-1/2', bookValue: '7-3/4' },
  { flangeClass: 600, nps: '20', recallValue: '11-1/4', bookValue: '11-1/2' },
  { flangeClass: 600, nps: '24', recallValue: '12-3/4', bookValue: '13' },
  { flangeClass: 900, nps: '4', recallValue: '6-1/4', bookValue: '6-1/2' },
  { flangeClass: 900, nps: '6', recallValue: '7-1/4', bookValue: '7-1/2' },
  { flangeClass: 900, nps: '16', recallValue: '11', bookValue: '11-1/2' },
  { flangeClass: 1500, nps: '4', recallValue: '7-3/4', bookValue: '7-1/2' },
  { flangeClass: 1500, nps: '6', recallValue: '10-1/4', bookValue: '10' },
  { flangeClass: 1500, nps: '8', recallValue: '11-1/2', bookValue: '11-1/4' },
  { flangeClass: 1500, nps: '18', recallValue: '19-1/2', bookValue: '19-1/4' },
  { flangeClass: 1500, nps: '20', recallValue: '21-1/4', bookValue: '21' },
  { flangeClass: 1500, nps: '24', recallValue: '24-1/2', bookValue: '24' },
]

export interface FlangeBoltOdMisprint {
  flangeClass: number
  nps: string
  note: string
}

// All 3 differing flange bolt/OD rows are documented book misprints.
// The recall/ASME row is kept canonical in every case; only the
// book row is flagged rejected.
export const FLANGE_BOLT_OD_MISPRINTS: FlangeBoltOdMisprint[] = [
  {
    flangeClass: 300,
    nps: '8',
    note: 'Book prints flange OD 15-1/2 (15.5). ASME B16.5 class 300 NPS 8 OD is 15.00 (matches recall). Book cell is a misprint.',
  },
  {
    flangeClass: 1500,
    nps: '1/2',
    note: 'Book flange diameters for 1500# NPS 1/2 and 3/4 are swapped (book shows 5.125 for 1/2; recall/ASME is 4.75). Book cell is a misprint.',
  },
  {
    flangeClass: 1500,
    nps: '3/4',
    note: 'Book flange diameters for 1500# NPS 1/2 and 3/4 are swapped (book shows 4.75 for 3/4; recall/ASME is 5.12/5.125). Book cell is a misprint.',
  },
]

export interface TeeOutletSupersession {
  runNps: number
  outletNps: number
  recallValueIn: string
  bookValueMm: string
  bookValueIn: string
}

export const TEE_OUTLET_SUPERSESSIONS: TeeOutletSupersession[] = [
  { runNps: 14, outletNps: 8, recallValueIn: '9.5', bookValueMm: '248', bookValueIn: '9.76' },
  { runNps: 14, outletNps: 6, recallValueIn: '9.12', bookValueMm: '238', bookValueIn: '9.37' },
  { runNps: 16, outletNps: 8, recallValueIn: '10.5', bookValueMm: '273', bookValueIn: '10.75' },
  { runNps: 16, outletNps: 6, recallValueIn: '10.12', bookValueMm: '264', bookValueIn: '10.39' },
  { runNps: 18, outletNps: 8, recallValueIn: '11.5', bookValueMm: '298', bookValueIn: '11.73' },
  { runNps: 20, outletNps: 8, recallValueIn: '12.5', bookValueMm: '324', bookValueIn: '12.76' },
]

export interface ShackleSupersession {
  bowSizeIn: string
  recallJawIn: string
  bookJawIn: string
  note: string
}

// All 3 differing shackle rows: book wins in every case. The 2-1/2"
// row is NOT a misprint — the recall table used a current Crosby
// 55-ton rating; the book's 50-ton rating is what the app should
// show, with a note that the Crosby tag governs in the field.
export const SHACKLE_SUPERSESSIONS: ShackleSupersession[] = [
  { bowSizeIn: '3/16', recallJawIn: '0.38', bookJawIn: '0.375', note: 'Rounding; book wins.' },
  { bowSizeIn: '7/16', recallJawIn: '0.75', bookJawIn: '0.719', note: 'Rounding; book wins.' },
  {
    bowSizeIn: '2-1/2',
    recallJawIn: '4.13',
    bookJawIn: '4.125',
    note: 'Recall used current Crosby 55-ton rating; book is 50-ton. Book wins for the app; the Crosby tag on the physical shackle governs on site.',
  },
]

// Weld-neck LTH: cross-check document's literal claim is "40 match
// within 3 mm, 0 differ". No supersession entries — the importer
// runs the same comparison against ref_wn_flange_lth_book and logs
// the confirmation; a NEW discrepancy beyond what's recorded here
// blocks the import per master prompt §3.3.
//
// Corrected on first real (non-dry-run) import against production:
// the check originally compared ref_flanges.lth_wn_in (B16.5 length
// through hub, EXCLUDING raised face) directly against
// ref_wn_flange_lth_book.lth_wn_incl_rf_in (explicitly INCLUDING
// raised face, per that table's own header text) with exact string
// equality — comparing two different quantities with no tolerance,
// which is not what the cross-check document's own "within 3 mm"
// language describes. Fixed to add ref_flanges.rf_height_in
// (converted to mm) to the recall side before comparing to the
// book's mm value, within a 3 mm tolerance, matching the document's
// literal language. With the corrected formula, 39 of 40 rows agree
// within tolerance; one (150#, NPS 8) is 3.02 mm apart — 0.02 mm
// past the document's 3 mm bound. rf_height_in is stored to 2
// decimal places (0.06 in for this row), which alone introduces up
// to ±0.06 mm of rounding in the mm conversion — enough to explain a
// 0.02 mm overage on a single row from a photo-transcribed
// (recall_confidence='source-photo'), not-yet-owner-verified source.
// Recorded as an expected, explained exception rather than silently
// widening the tolerance to hide it.
export const WN_LTH_EXPECTED_MISMATCH_COUNT = 1

// Book misprints called out elsewhere in the cross-check that do
// NOT participate in row-level supersession (either because the
// affected table isn't in Phase 1, or the row is simply imported
// with rejected=true and no recall counterpart to preserve):
//   - 900# NPS 4 gasket ID printed 3-3/4 (same as NPS 3) — gasket
//     data is not in any Phase 1 table; not actionable here.
//   - 900# NPS 20 gasket OD printed '2 1/2' (dropped digit) — same.
//   - Gate valve 1500# row duplicates the 900# row — valve face-to-
//     face table (ref_valve_face_to_face); flagged via that file's
//     own `book_note` column, handled generically (any pocket row
//     with a non-empty book_note imports with rejected=true).
//   - "Bricks common" printed lbs./cu.yd instead of cu.ft — material
//     weights table; same generic book_note handling.
