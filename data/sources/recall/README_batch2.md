# PipeField OS reference data — batch 2

| File | Rows | What |
|---|---|---|
| `ref_sw_fittings_b16_11.csv` | 24 | ASME B16.11 socket-weld, class 3000 and 6000, NPS ⅛–4: socket bore min/max, socket depth J, socket wall C, fitting bore D, center-to-socket-bottom A for 90/tee and for 45 |
| `ref_bolt_drill_tap.csv` | 60 | UNC/UNF tap drills with close/free clearance drills; metric coarse M3–M36 tap and clearance; NPT tap drills ⅛–2 |
| `ref_npt_threads_b1_20_1.csv` | 19 | ASME B1.20.1 NPT 1/16–12: TPI, pitch, OD, hand-tight L1 (length and turns), effective thread L2, wrench makeup, total makeup |
| `ref_flange_weights_b16_5.csv` | 204 | Approx carbon-steel weights: WN all classes; SO 150/300; blind 150/300/600 |
| `ref_flange_hubs_b16_5.csv` | 132 | Hub diameter at base X, hub at bevel A (= pipe OD), slip-on bore B, all classes |
| `ref_reducing_tee_outlet_b16_9.csv` | 73 | Reducing tee outlet center-to-end M by run × outlet, with run C for reference |
| `VALIDATION_REPORT_batch2.md` | — | checks run, what to verify first, calculator formulas |

Every row: `verified=false`, `source_doc` = recall, plus a `recall_confidence` column (high / medium / low) to prioritise checking. Flip `verified`, `verified_by`, `verified_against` as you go.

Not included
- SW couplings (full/half) and SW unions; threaded fitting (B16.3 / B16.11 threaded) center-to-end.
- Flange weights for SO above class 300, blind above class 600, lap-joint, threaded.
- Stud bolt lengths by class and size (high error rate from recall; supply a catalog page and I'll build the table from it).
