# DATA_SOURCE_MANIFEST — Field Mode Phase 1

Master prompt §3.5 deliverable. Lists every known gap, discrepancy,
and deferred item in the reference-library data imported by
`scripts/field-mode/import-reference-data.ts`. Nothing below is
invented — every line is transcribed from `README_batch{1,2,3}.md`,
`VALIDATION_REPORT_batch{1,2,3}.md`, or `CROSS_CHECK_pocket_tradesman.md`
under `data/sources/`, or is a direct observation of the CSVs
themselves (noted as such).

## 1. Coverage gaps (data that does not exist in any source file)

Quoted from the batch READMEs, which were written by whoever produced
the recall CSVs — these are gaps in *availability*, not import bugs.

- **Flange weights**: WN all classes and SO 150/300 and blind
  150/300/600 only. **Not included**: "Flange weights for SO above
  class 300, blind above class 600, lap-joint, threaded." (README_batch2 §Not included)
- **Flange hub / bore**: hub diameter (X), hub at bevel A, slip-on
  bore B are covered for all classes in batch 2 — batch 1's README
  originally listed these as a gap before batch 2 filled it; batch 2
  supersedes that note.
- **Lap-joint and threaded-flange LTH**: not included in any batch.
  (README_batch1 §Not included, restated in README_batch2)
- **Reducing tee outlet (M)**: covered by run×outlet in
  `ref_reducing_tee_outlet_b16_9.csv` (73 rows) — batch 1's "not
  included" note is superseded by batch 2.
- **3D bends, stub ends, 180° SR returns**: "Not included (request
  separately or supply a source)." (README_batch1 §Not included).
  LR180 return dimensions (O, K) ARE included in
  `ref_bw_fittings_b16_9.csv`, computed and marked `derived=true`
  (O = 2A, K = A + OD/2) — only the *SR* 180° return is the gap.
- **Class 2500 above NPS 12**: "B16.5 stops there" — not a gap, this
  size range does not exist in the standard. (README_batch1)
- **SW couplings / unions and threaded fitting (B16.3/B16.11) center-
  to-end**: listed as a batch-2 gap, then filled in batch 3
  (`ref_sw_couplings_b16_11.csv`, `ref_threaded_fittings_ctr_to_end.csv`).
- **Stud torque values**: deliberately excluded, not a gap — "they
  depend on lubricant, gasket, and bolt material and must come from
  the project's bolting spec." (VALIDATION_REPORT_batch3 §Things the
  app must say out loud). Field Mode must never compute or display a
  torque value from these tables.
- **B16.11 socket-weld NPS ⅛–⅜**, all columns, and **NPS 4 class 6000
  A**: present in the data but flagged lowest-confidence, not a
  literal gap — see §3 below.

## 2. recall_confidence: actual values vs. spec

Master prompt §3.1 specifies the enum `high / medium / low / computed
/ unrated`. Direct inspection of every CSV that carries a
`recall_confidence` column (22 of 24 recall files; `ref_flanges` and
`ref_bw_fittings` — the batch-1 files — lack the column entirely and
get the importer's `unrated` default) found these actual values in
use:

```
computed, high, low, medium, source-photo, source-photo-stepped-chart
```

`source-photo` and `source-photo-stepped-chart` are pocket-tradesman
values (the book data's provenance is a photographed page, not a
recall) and are not in the master prompt's enum.

**Decision**: `recall_confidence` is imported as unconstrained TEXT,
not a Postgres CHECK/ENUM constraint (see
`scripts/field-mode/gen-migration.ts`). Enforcing the 5-value enum
would have silently rejected 100% of pocket-tradesman rows at import
time. This is a Phase 1 design deviation from §3.1's literal enum
list, made to avoid data loss; flagging it here rather than silently
widening the spec.

## 3. Lowest-confidence items — check these first

Direct quotes from the "check these first" sections of
`VALIDATION_REPORT_batch2.md` and `VALIDATION_REPORT_batch3.md`
(batch 1 has its own flag review, transcribed into
`scripts/field-mode/lib/checks.ts` as import-time assertions instead
of a manual list):

- B16.11 socket-weld 45° elbow A dimensions, both classes.
- B16.11 NPS ⅛–⅜, all columns; NPS 4 class 6000 A (3.19).
- B16.11 NPS 4 class 3000 socket wall C (0.318 vs. Sch 80 wall 0.337
  for NPS 4 — one of these is what the table says).
- Flange weights class 900 and up (manufacturers differ ±10%,
  "planning-grade, never rigging-grade, until verified").
- Hub diameter X, class 900 and up.
- Reducing tee 10×3½, 16×14, 24×22.
- Threaded forged fittings (B16.11 class 2000/3000/6000) center-to-
  end — all rows `low`; "if a B16.11 forged row disagrees with a
  manufacturer page, the page wins."
- SW couplings — full-coupling length W `low` across the board;
  half-coupling length is an estimate, not a table value.
- Stud bolts class 600 and up — length practice varies with gasket
  type; all `low`.
- Synthetic slings — WLL differs by manufacturer/web class, "the tag
  on the sling governs, always." Orange round sling is `low`.
- Shackles below ⅜ and above 1½ — `medium`.

## 4. Batch-3 stud-length flags — reconciled here, not yet in checks.ts

`VALIDATION_REPORT_batch3.md` lists 24 "below/above plausible minimum"
flags for `ref_stud_bolts`. Its own **Flag review** section resolves
23 of them as expected:

> "Stud lengths, class 900/1500 NPS ½–16 'below plausible minimum':
> every one is 0.05–0.35 in short of a minimum that already includes
> a ¼ in protrusion allowance. That is the check being conservative,
> not a wrong length. Treat as consistent."

One flag is called out as a real outlier, explicitly unresolved:

> "Stud 2500# NPS 12, 2¾ × 23¼: 2.4 in longer than the plausible
> band. This is the one stud row to check first."

**Status**: neither the 23 conservative-check flags nor the one real
outlier are encoded as an importer assertion in `checks.ts` (which
currently only encodes the batch-1 flange/BW-fitting checks). This
row imports successfully (validation and batch-1 checks don't apply
to `ref_stud_bolts`) but its `recall_confidence` is whatever the CSV
carries — it is **not** auto-flagged by any importer-time check. The
one real outlier (2500# NPS 12) must be checked manually; see the
Phase 1 completion notes for how the default verification sort
surfaces it in the meantime.

Batch 2 reports **zero** internal flags ("none. That means the tables
agree with themselves and with the arithmetic of the standards; it
does not mean the numbers are right.") — no follow-up needed for
batch 2's own consistency, only the confidence-ordering list in §3.

## 5. Provenance / display rules the app must carry forward

Not gaps, but constraints the Phase 3 UI must not violate — quoted so
they aren't lost between phases:

- "Rigging tables are reference only. The tag, the manufacturer
  chart, and the site lift plan govern. Show that sentence on every
  rigging screen." (batch 3)
- "Exposure limits in the gas table mix OSHA PELs and ACGIH TLVs,
  which differ; the note column says which. Show the jurisdiction's
  limit, not both." (batch 3)
- "Hand signals: ASME B30.5 set. Sites add signals; the posted chart
  on the crane governs." (batch 3) — this is also why
  `ref_hand_signals_book` exists as a second, jurisdiction-keyed set
  per master prompt §3.2b rather than overwriting the ASME set.

## 6. Pocket-tradesman misprints not covered by row-level supersession

From `CROSS_CHECK_pocket_tradesman.md`, transcribed into
`scripts/field-mode/lib/precedence.ts`'s trailing comment. These are
called out in the cross-check but do not have a Phase 1 table to
attach a supersession to:

- 900# NPS 4 gasket ID printed 3-3/4 (same as NPS 3) — no gasket-
  dimension table exists in Phase 1.
- 900# NPS 20 gasket OD printed "2 1/2" (a dropped digit) — same.
- Gate valve 1500# row duplicates the 900# row in
  `ref_valve_face_to_face` — handled generically: any pocket row with
  a non-empty `book_note` imports with `rejected=true` (see
  `import-reference-data.ts`'s book_note rule). Confirmed against the
  live database after the first real import: `ref_valve_face_to_face`
  has 5 of 75 rows `rejected=true`, `ref_flange_bolting_book` has 6 of
  80 — `ref_valve_face_to_face` and `ref_flange_bolting_book` are the
  only two files with a `book_note` column.
- "Bricks common" printed lbs./cu.yd instead of cu.ft in the material
  weights book table (`ref_material_weights_book`) — **correction,
  made after the first real (non-dry-run) import**: this table has no
  `book_note` column at all (confirmed against the live schema, and
  by a live count showing 0 rejected rows out of 57), so the generic
  `book_note` rejection rule the bullet above describes does not and
  cannot fire here. The misprint is instead recorded as inline text
  inside the `weight_as_printed` value itself ("121 lb/cu ft (book
  prints cu.yd — likely misprint)") — self-documenting data, not a
  machine-enforced rejection. An earlier draft of this manifest
  incorrectly claimed "same generic `book_note` handling" for this
  row, directly contradicting this section's own correct statement
  (above) that only `ref_valve_face_to_face` and
  `ref_flange_bolting_book` carry a `book_note` column. Flagging here
  rather than silently correcting without a trace: a future phase
  that wants this misprint machine-flagged (rather than just
  human-readable in the value) would need to add a `book_note` column
  to this CSV/table, not assume it already behaves like the other
  two.

## 7. Design decisions made in the absence of explicit prompt direction

- **`_book`-suffixed tables** for the 9 pocket-tradesman files that
  cover the same subject as a recall table but carry different
  columns (`ref_chain_slings_book`, `ref_flange_bolting_book`,
  `ref_material_weights_book`, `ref_synthetic_slings_book`,
  `ref_reducing_tee_outlets_book`, `ref_shackles_book`,
  `ref_wire_rope_slings_book`, `ref_wn_flange_lth_book`,
  `ref_hand_signals_book`) — see `scripts/field-mode/lib/table-map.ts`
  header comment for the full reasoning (forcing differently-shaped
  CSVs into one table would violate §3.2's "don't rename/normalize
  columns" rule).
- **`recall_confidence` as TEXT, not an enum** — see §2 above.
