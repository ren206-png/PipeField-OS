# PipeField OS reference data — batch 1

Files
- `ref_flanges_b16_5.csv` — 132 rows. ASME B16.5 classes 150, 300, 400, 600, 900, 1500, 2500; NPS ½–24 (2500 to NPS 12). OD, thickness, bolt circle, bolt count/size/hole, raised-face dia and height, length-through-hub for weld neck and slip-on. Inches as recalled, mm computed (×25.4, 1 dp).
- `ref_bw_fittings_b16_9.csv` — 166 rows. ASME B16.9 NPS ½–24: LR90 (A), LR45 (B), SR90 (A, from NPS 1), equal tee (C), cap (E), concentric/eccentric reducer (H). LR180 return O and K are derived (O = 2A, K = A + OD/2) and marked `derived=true`.
- `VALIDATION_REPORT_batch1.md` — internal-consistency checks and flag review.

Provenance
- `source_doc` on every row says exactly what it is: my recall, not an independent source. `verified=false` on every row.
- `edition` is `UNSPECIFIED-verify`. Set it when you verify against a dated book.

Conventions
- Class 150/300: thickness and LTH include the 0.06" raised face (rf_height_in = 0.06).
- Class 400 and up: thickness and LTH exclude the 0.25" raised face (rf_height_in = 0.25). Add 0.25" for total.
- Bolt sizes are nominal imperial (e.g. `1-1/8`). Bolt hole is the flange drilling.
- Blind flange thickness = same `thickness_in` column.

Not included (request separately or supply a source)
- Flange weights, hub diameter (X), bore (B), lap-joint and threaded LTH.
- Reducing tee outlet (M) by outlet size, 3D bends, stub ends, 180° SR returns.
- Class 2500 above NPS 12 (B16.5 stops there).
