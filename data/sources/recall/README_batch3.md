# PipeField OS reference data — batch 3

| File | Rows | What |
|---|---|---|
| `ref_shackles.csv` | 17 | Screw-pin anchor shackles 3/16–2½: WLL, inside width at pin (jaw), pin dia, inside length |
| `ref_sling_leg_factors.csv` | 13 | Leg-load multiplier 90°→30° (computed 1/sin) |
| `ref_snatch_block_factors.csv` | 11 | Block load multiplier by line angle (computed 2cos θ/2) |
| `ref_wire_rope_sling_swl.csv` | 16 | 6×19/6×36 IWRC EIPS, ¼–2: vertical / choker / basket, breaking strength, 8D² rule of thumb |
| `ref_synthetic_sling_wll.csv` | 18 | Nylon web 1- and 2-ply 1–6 in; polyester round slings purple→orange |
| `ref_chain_sling_wll.csv` | 17 | Grade 80 and 100 single-leg vertical |
| `ref_hand_signals.csv` | 20 | ASME B30.5 crane signals, text descriptions + image asset names |
| `ref_conversion_factors.csv` | 54 | Length, area, volume, mass, force, pressure, energy, power, flow, velocity, torque, density, temperature |
| `ref_water_head_pressure.csv` | 42 | 1–500 ft head → psi / kPa (computed) |
| `ref_gas_properties.csv` | 26 | LEL/UEL, vapor density, heavier-than-air, exposure-limit notes |
| `ref_material_weights.csv` | 35 | lb/ft³, kg/m³, SG |
| `ref_plate_steel_weights.csv` | 19 | ⅛–3 in plate: lb/ft², kg/m², lb per 4×8 sheet (computed) |
| `ref_stud_bolts_b16_5.csv` | 109 | Stud dia × length, count per flange, heavy-hex wrench size, nut height, thread series, all classes |
| `ref_wrench_sizes.csv` | 27 | Heavy/regular hex AF ½–3½ (computed from B18.2.2 formula); pipe wrench sizing practice |
| `ref_threaded_fittings_ctr_to_end.csv` | 56 | B16.11 forged 2000/3000/6000, B16.3 malleable 150, B16.4 cast iron 125: 90/tee and 45 center-to-end |
| `ref_sw_couplings_b16_11.csv` | 12 | Full coupling length W, socket depth J, center wall, half-coupling estimate |

Every row: `verified=false`, `source_doc` = recall, `recall_confidence` (high / medium / low / computed). Computed rows are arithmetic from a stated formula and only need the formula checked.

When you send a catalog or field-book page for any table, I rebuild that table from the page, set `source_doc` to the page, and drop the recall version.
