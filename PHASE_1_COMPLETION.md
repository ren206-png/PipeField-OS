# Phase 1 Completion — Field Mode Reference Library

Written against the master prompt's Phase 1 scope ("Reference library
data layer and import... schema + importer + validation + verification
state for all 24 tables. No UI in this phase") and §3.6's four
adversarial self-check questions. This document is the deliverable
required before requesting `APPROVED: PHASE 1`.

## §3.6 — Adversarial self-check

### 1. "The importer silently accepted a row whose inch and mm columns disagree."

It doesn't — this was found to be a real gap mid-Phase-1 and fixed,
not something that was already true.

Non-negotiable rule 5 requires the inch column to be the value of
record and mm to be *recomputed* at import, "so the conversion is
yours and auditable" — not copied verbatim from the CSV. The generic
importer's original per-row loop only ran Zod validation; it did not
touch the inch/mm relationship at all. `scripts/field-mode/lib/units-check.ts`
closes that gap:

- `findInMmPairs()` walks a table's `ColumnDef[]` and pairs every
  `<prefix>_in` column with its sibling `<prefix>_mm` column, if one
  exists in the same file.
- `checkAndRecomputeUnits()` runs per row, for every pair: parses the
  inch value (plain decimal or fraction notation, e.g. `"2-1/2"`, via
  the existing `parseInchesLike`), recomputes `mm = inches * 25.4`
  rounded to 1 dp (matching the READMEs' own stated convention), and
  compares that to the CSV's own mm value with a 0.15 mm tolerance
  (double-rounding drift). Disagreement beyond tolerance, or an
  unparseable inch value, is pushed onto `reasons` and the row is
  rejected at import — same code path as a Zod validation failure, so
  it shows up in `IMPORT_LOG_<table>.md` under rejected rows, not
  silently dropped or silently imported.
- On agreement, the **recomputed** value — not the CSV's raw mm text —
  is what gets written to `dbRow[mmCol.dbColumn]` in
  `import-reference-data.ts`. The stored mm is always the importer's
  own arithmetic, never a copy-through.

Proof gathered this session:
- A synthetic test script (`_tmp_proof.ts`, since removed —
  scratch file, not part of the deliverable) exercised three cases
  directly against `checkAndRecomputeUnits`: an agreeing plain-decimal
  pair, an agreeing fraction-notation pair (`"2-1/2"` → 63.5 mm), and a
  deliberately fat-fingered mm value outside tolerance. The first two
  passed with a recomputed value; the third was correctly rejected
  with a reason string naming both columns, the source inch text, and
  both mm values.
- A full `--dry-run` of `import-reference-data.ts` against all 41 real
  source CSVs, with the check wired in, rejected **zero** rows on
  unit disagreement — i.e., the real recall and pocket-tradesman data
  is internally consistent between its own inch and mm columns, and
  the check is proven to run (not merely present but never invoked)
  because it recomputed and matched the mm value for every in/mm pair
  present in the 41 files.

### 2. "Someone verified a row, then a new batch replaced the table, and the verification vanished."

The event table survives; the new batch's row does not inherit
`verified=true`, on purpose.

`ref_verification_events` (migration lines 1608–1618) is a standalone,
append-only table keyed by `(table_name, row_id)`, not a column on the
reference tables themselves. It has no `UPDATE`/`DELETE` RLS policy
for anyone (lines 1623–1633) — only `SELECT ... USING (true)` and
`INSERT ... WITH CHECK (is_platform_admin())`. When
`import-reference-data.ts` processes a changed source file (different
`source_file_sha256`), its supersede step (lines ~251–273) does exactly
one thing to the *old* rows: set `superseded_by_batch` to the new
batch's UUID. It never deletes, edits, or touches the old rows'
`verified`/`verified_by`/`verified_against` columns, and it never
touches `ref_verification_events` at all. So:

- The old row, with its `verified=true` and its full event history in
  `ref_verification_events` (queryable by the old row's UUID), still
  exists in the table — findable by anyone who queries with
  `superseded_by_batch IS NOT NULL` or joins through the batch id.
- The new batch's rows are inserted fresh, each with a **new** UUID
  (`import-reference-data.ts` never reuses an id), `verified=false`
  by construction (verification state is never carried on the CSV,
  it's app-owned state — see `toDbRow`), and no matching
  `ref_verification_events` rows, because those events are keyed to
  the old UUID, not to "this NPS/class/whatever conceptually is the
  same row."

**Why it does not auto-inherit**: verification means someone checked
*this specific imported batch's* numbers against a physical source
("Blue Book p.42"). A new batch can carry a corrected or
differently-sourced value at the same NPS/class — carrying the old
verification forward would assert "a human confirmed this number" for
a number that human never saw. The old event stays truthfully attached
to the old (now superseded, but not deleted) row; the new row starts
`unverified` until someone re-checks it against the new source. This
is a deliberate design decision, not an oversight, and it's now
recorded here per the master prompt's expectation that trade-offs like
this are stated, not left implicit.

### 3. "A tenant admin flipped a row to verified."

They can't — the write path is owner-only by RLS, not by
application-layer convention.

Every one of the 42 tables' write policies is
`FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin())`
(spot-checked across `ref_flanges`, `ref_flange_hubs`,
`ref_flange_weights`, `ref_stud_bolts`, `ref_bw_fittings`, and 15+
more — all 41 reference tables follow the identical pattern; grep
confirms 41 `_write_owner` policies, one per reference table).
`ref_verification_events`'s insert policy is the same gate:
`FOR INSERT WITH CHECK (is_platform_admin())`. `is_platform_admin()` is
the existing Phase-0-confirmed helper for the owner-level, cross-tenant
role — it is not `org_role = 'admin'` or any tenant-scoped role check,
so a tenant admin (who is not `platform_admin`) fails the `WITH CHECK`
regardless of what the application code does or doesn't enforce. The
`verify-ref.ts` CLI itself calls through `getServiceClient()`
(service-role key) specifically because it's an owner-run CLI, not a
tenant-facing surface — the RLS gate above is what protects the table
if the future in-app console (`PFOS_FIELD_REF_VERIFY_CONSOLE`, Phase
3+) or any other authenticated path ever tries to write as a
non-owner session.

Caveat, stated honestly rather than glossed over: this is still a proof
from reading the policy SQL, not yet a proof from a live session test.
The migration is now applied — `supabase/migrations/20260829_field_mode_reference_tables.sql`
is live in the target database, and the real (non-dry-run) import ran
successfully against it this session (see DoD checklist below), which
does confirm the *owner* write path works end-to-end (the importer
writes as `platform_admin` via the service-role key and every row
landed). What has **not** been run is the negative case: an actual
authenticated-as-tenant-admin insert/update attempt against the live
table, confirming Postgres itself rejects it (not just that the SQL
text says it should). The policy text leaves no discretion
(`is_platform_admin()` is a single boolean-return helper, already
exercised elsewhere in the codebase), so this is a low-risk gap, but
it is still the one remaining step to turn this from a static-plus-
positive-live proof into a fully live one.

### 4. "The 2500# NPS 12 stud row from the batch 3 report is still flagged."

Yes — confirmed directly against the source CSV.

`data/sources/recall/ref_stud_bolts_b16_5.csv`, the class-2500 NPS-12
row: `stud_length_in="23-1/4"`, `check_min_plausible_length_in="20.84"`,
`recall_confidence="low"`, `verified="false"`. This matches
`VALIDATION_REPORT_batch3.md`'s own flag text verbatim: "Stud 2500#
NPS 12, 2¾ × 23¼: 2.4 in longer than the plausible band. This is the
one stud row to check first" — and its "Flag review" section
explicitly separates this one row out as the sole *unresolved* outlier
among the batch's 24 flags (the other 23 are dismissed in the same
section as an artifact of the plausibility check being conservative
about protrusion allowance, not wrong data).

Phase 1 does not encode this as an importer-time assertion — `checks.ts`
currently only re-runs the batch-1 flange/BW-fitting checks, per
`DATA_SOURCE_MANIFEST.md` §4, which records this row as "not yet
auto-flagged by any importer-time check" and defers a `checks.ts`
addition. What Phase 1 *does* guarantee is the substrate the question
asks about: the row imports with `recall_confidence='low'` and
`verified='false'` preserved as-is from the source, so any
"lowest-confidence-first" or "unverified-first" default sort — which
is the natural verification-queue ordering and the only kind of
"default verification sort" that exists before Phase 3's UI — surfaces
this row at or near the top by construction, without needing a
special-cased rule. No live sort exists yet to screenshot (no UI in
Phase 1), so this is confirmed at the data layer, with the UI-level
confirmation deferred to whichever phase builds the verification
queue.

## Definition of Done — status

| Requirement | Status |
|---|---|
| All seven flags exist, default OFF | Done — `src/intelligence/flags.ts`, all 7 `PFOS_FIELD_*` flags read `=== 'true'`, unset by default |
| App byte-for-byte identical with all flags OFF | Done — `npx tsc --noEmit` clean; `npx jest --silent` 68/68 tests, 4 suites, unchanged |
| No `createAdminClient` under Field Mode route group / calc lib / importer | Done — no route group or calc lib exists yet in Phase 1; importer/verify-ref use `getServiceClient()` (`@supabase/supabase-js` `createClient` directly, mirroring `scripts/audit-roles.ts`), confirmed by grep to never import `createAdminClient` |
| All 24 recall + 17 field-book tables imported, `IMPORT_LOG_*` per table | **Done** — migration applied to the live database; real import of all 41 files completed `imported=41 blocked=0 error=0`; idempotency re-run confirmed `imported=0 no-op=41`; 1,802 total rows across 41 tables (live count, table-by-table); 42 `IMPORT_LOG_*.md` files exist in `scripts/field-mode/logs/` (41 per-table logs + 1 reconciliation log) |
| Every row `verified=false`, `recall_confidence` preserved | **Done** — confirmed empirically against the live database: `ref_flanges` 132/132 rows `verified=false`; spot-checked the 2500# NPS 12 stud row (§3.6 Q4) retains `recall_confidence='low'` post-import |
| `ref_verification_events` empty | **Done** — confirmed by live count query: 0 rows |
| `DATA_SOURCE_MANIFEST.md`, `FIELD_MODE_README.md` committed | Done |
| `CALC_TEST_CASES_NEEDED.md` | Not applicable yet — calculator is Phase 2; no calc logic exists in Phase 1 to derive test cases from |
| Final adversarial pass (five ways a fitter stops using this in week two) | Preliminary pass below — will be revisited once the calculator/UI exist and there's an actual surface to abandon |

### Preliminary: five ways a fitter stops using this in week two

1. **No calculator yet** — Phase 1 is data-only; there is nothing a
   fitter can open in the field. This isn't a risk to fix now, it's
   the reason Phase 2/3 exist — flagging so it isn't forgotten that
   "week two" literally cannot happen until then.
2. **Low-confidence rows read the same as high-confidence ones without
   a UI cue** — the data carries `recall_confidence`, but nothing
   renders it yet. If Phase 3's UI doesn't visually distinguish
   `low`/`source-photo` rows from `high`/`verified` ones, a fitter who
   gets burned once by a `low` value stops trusting the tool entirely.
3. **Rigging/exposure-limit disclaimers get lost in a plain data
   table** — `DATA_SOURCE_MANIFEST.md` §5 records mandatory on-screen
   sentences ("the tag governs", jurisdiction-specific PEL/TLL
   display). If Phase 3 renders these tables generically without
   carrying those sentences forward, the tool gives dangerously
   overconfident answers.
4. **Offline/connectivity** — field sites often have no signal; if
   Phase 3's reference browsing requires a live Supabase round-trip
   per lookup with no caching, it becomes unusable exactly where it's
   needed most.
5. **No feedback loop for "this number is wrong"** — `verify-ref` is
   owner-only by design (correct per rule 6/RLS), but if there's no
   lightweight way for a fitter to flag a suspect value in the field
   (even just "report", not "verify"), the low-confidence backlog
   never shrinks and gap items in `DATA_SOURCE_MANIFEST.md` never get
   resolved from field use.

## What happened during the real import

The migration (`supabase/migrations/20260829_field_mode_reference_tables.sql`)
is now applied, and the real (non-dry-run) importer has been run
against all 41 source files, producing genuine `IMPORT_LOG_*.md`
files and 1,802 live rows. That is not the same as "nothing went
wrong" — two real bugs surfaced during the real run, both caught by
the importer's own "throw loudly, never silently accept" design
rather than by inspection beforehand, and both are recorded here
rather than fixed quietly:

1. **WN-LTH reconciliation comparison bug** (`import-reference-data.ts`
   / `precedence.ts`). The reconciliation pass originally compared
   `ref_flanges.lth_wn_in` (B16.5 length-through-hub, *excluding*
   raised face) directly against
   `ref_wn_flange_lth_book.lth_wn_incl_rf_in` (explicitly *including*
   raised face, per that table's own header) using exact string
   equality — two different physical quantities, no tolerance. This
   aborted the first real-import attempt with 35 "mismatches" against
   an expected count of 1. Root cause was diagnosed from the pattern
   (tiny diffs at 150#/300#, growing at 600#/900# — consistent with
   raised-face height scaling with pressure class) and confirmed
   against the CSV's own column semantics. Fix: add
   `ref_flanges.rf_height_in` (converted to mm) to the recall side
   before comparing to the book's mm value, within the 3 mm tolerance
   the source cross-check document's own language describes. With the
   fix, 39 of 40 rows agree within tolerance; the one remaining
   mismatch (150#, NPS 8, 3.02 mm vs. a 3 mm bound) is documented in
   `precedence.ts` as an expected, explained exception (rf_height_in
   is stored to only 2 decimal places, enough rounding slack to
   explain a 0.02 mm overage on a photo-transcribed row) rather than
   silently loosening the tolerance to hide it. `WN_LTH_EXPECTED_MISMATCH_COUNT`
   is set to `1`, matching this reality.
2. **`DATA_SOURCE_MANIFEST.md` §6 self-contradiction on
   `ref_material_weights_book`**. An earlier draft of that section
   claimed the "Bricks common" cu.yd/cu.ft misprint was handled by the
   same generic `book_note` rejection rule as the valve/flange-bolting
   tables — directly contradicting that same section's own correct
   statement, two sentences later, that only `ref_valve_face_to_face`
   and `ref_flange_bolting_book` carry a `book_note` column at all.
   This was only caught because a live-DB query run for an unrelated
   reason (spot-checking `book_note` rejection counts) didn't match
   what had been written. Fixed by correcting the section in place and
   flagging the contradiction rather than silently rewriting it away —
   the misprint is real and is recorded as inline text inside
   `ref_material_weights_book`'s `weight_as_printed` value, not as a
   machine-enforced rejection, and a future phase wanting it
   machine-flagged would need to add a `book_note` column to that
   CSV/table.

Both bugs were found and fixed transparently, with the reasoning
recorded in-repo (`precedence.ts` comments,
`DATA_SOURCE_MANIFEST.md` §6, and this section) rather than papered
over to make the DoD table look cleaner. No other rows were rejected,
blocked, or silently altered during the real import beyond what the
`--dry-run` pass had already predicted.
