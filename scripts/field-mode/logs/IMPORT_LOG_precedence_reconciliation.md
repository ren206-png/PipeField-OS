# IMPORT_LOG_precedence_reconciliation

Run at: 2026-08-31T03:10:06.512Z

Reconciliation batch id: a403ab1f-da6c-4d97-a40c-a9bc31baa955

## Stud length (ref_stud_bolts -> ref_flange_bolting_book)
- SKIP class 150 NPS 3/4: row missing (recall=false, book=true)
- SKIP class 150 NPS 10: row missing (recall=false, book=true)
- SKIP class 150 NPS 16: row missing (recall=false, book=true)
- SKIP class 150 NPS 18: row missing (recall=false, book=true)
- SKIP class 150 NPS 24: row missing (recall=false, book=true)
- SKIP class 300 NPS 3/4: row missing (recall=false, book=true)
- SKIP class 300 NPS 1: row missing (recall=false, book=true)
- SKIP class 300 NPS 20: row missing (recall=false, book=true)
- SKIP class 300 NPS 24: row missing (recall=false, book=true)
- SKIP class 600 NPS 3/4: row missing (recall=false, book=true)
- SKIP class 600 NPS 8: row missing (recall=false, book=true)
- SKIP class 600 NPS 20: row missing (recall=false, book=true)
- SKIP class 600 NPS 24: row missing (recall=false, book=true)
- SKIP class 900 NPS 4: row missing (recall=false, book=true)
- SKIP class 900 NPS 6: row missing (recall=false, book=true)
- SKIP class 900 NPS 16: row missing (recall=false, book=true)
- SKIP class 1500 NPS 4: row missing (recall=false, book=true)
- SKIP class 1500 NPS 6: row missing (recall=false, book=true)
- SKIP class 1500 NPS 8: row missing (recall=false, book=true)
- SKIP class 1500 NPS 18: row missing (recall=false, book=true)
- SKIP class 1500 NPS 20: row missing (recall=false, book=true)
- SKIP class 1500 NPS 24: row missing (recall=false, book=true)

## Flange bolt/OD misprints (ref_flange_bolting_book rows flagged rejected)
- class 300 NPS 8: book row flagged rejected — Book prints flange OD 15-1/2 (15.5). ASME B16.5 class 300 NPS 8 OD is 15.00 (matches recall). Book cell is a misprint.
- class 1500 NPS 1/2: book row flagged rejected — Book flange diameters for 1500# NPS 1/2 and 3/4 are swapped (book shows 5.125 for 1/2; recall/ASME is 4.75). Book cell is a misprint.
- class 1500 NPS 3/4: book row flagged rejected — Book flange diameters for 1500# NPS 1/2 and 3/4 are swapped (book shows 4.75 for 3/4; recall/ASME is 5.12/5.125). Book cell is a misprint.

## Reducing tee outlet (ref_reducing_tee_outlets -> ref_reducing_tee_outlets_book)
- SKIP run 14 x outlet 8: row missing (recall=false, book=true)
- SKIP run 14 x outlet 6: row missing (recall=false, book=true)
- SKIP run 16 x outlet 8: row missing (recall=false, book=true)
- SKIP run 16 x outlet 6: row missing (recall=false, book=true)
- SKIP run 18 x outlet 8: row missing (recall=false, book=true)
- SKIP run 20 x outlet 8: row missing (recall=false, book=true)

## Shackles (ref_shackles -> ref_shackles_book)
- SKIP bow 3/16: row missing (recall=false, book=true)
- SKIP bow 7/16: row missing (recall=false, book=true)
- SKIP bow 2-1/2: row missing (recall=false, book=true)

## Weld-neck LTH confirmation (ref_flanges.lth_wn_mm + rf_height_in vs ref_wn_flange_lth_book.lth_wn_incl_rf_mm, 3mm tolerance)
- Confirmed: 1 mismatches beyond 3mm tolerance (expected 1). No rows changed.
  - 150|8: recall 103.12 mm (incl. RF) vs book 100.1 mm, diff 3.02 mm
