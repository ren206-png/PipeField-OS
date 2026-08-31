# Field Mode — module README

Status as of Phase 1: reference-library data layer only. No UI, no
calculator, no route group exists yet. This file will grow with each
phase; sections below are marked with the phase that fills them in.

## How to enable per tenant (Phase 1 status: N/A — no UI yet)

Field Mode is gated by seven flags in `src/intelligence/flags.ts`,
all defaulting OFF via `process.env.PFOS_FIELD_*`:

- `PFOS_FIELD_MODE` — master switch; every other Field Mode flag is a
  no-op while this is OFF.
- `PFOS_FIELD_REFERENCE` — reference-library browsing UI (Phase 3).
- `PFOS_FIELD_CALC` — calculator engine UI (Phase 3, engine itself is
  Phase 2 and framework-free — it doesn't need a flag to exist, only
  to be reachable).
- `PFOS_FIELD_SCAN_LOG` — scan-to-log weld flow (Phase 3).
- `PFOS_FIELD_PERSONAL_LOG` — personal weld/fit log (Phase 4).
- `PFOS_FIELD_VOICE_NOTES` — voice-note capture on the personal log
  (Phase 4).
- `PFOS_FIELD_REF_VERIFY_CONSOLE` — owner-facing in-app verification
  console (Phase 3+, `platform_admin` only). Until this ships, use
  the `verify-ref` CLI described below.

None of these have a per-tenant DB override wired up yet (the
existing `org_feature_flags` table supports it — see Phase 0
findings — but Field Mode hasn't needed one since there's no UI to
gate per-org yet). When Phase 3 adds the UI, follow the existing
`org_feature_flags` resolution order (DB row > env var > false).

## How the reference library is imported (Phase 1)

Source of truth is `/data/sources/recall/` (24 CSVs, ASME-standard
recall data) and `/data/sources/pocket-tradesman/` (17 CSVs,
transcribed from the owner's field book). Both are read-only inputs —
nothing in `scripts/field-mode/` ever rewrites a source CSV.

```
# Validate everything without touching the database:
npx tsx scripts/field-mode/import-reference-data.ts --dry-run

# Real import (requires the migration already applied — see below):
npx tsx scripts/field-mode/import-reference-data.ts

# Import/re-check a single table:
npx tsx scripts/field-mode/import-reference-data.ts --table ref_flanges
```

The importer is idempotent: re-running it against an unchanged file
is a no-op (matched by `source_file_sha256`). Output logs land in
`scripts/field-mode/logs/IMPORT_LOG_<table>.md`.

## How to import a replacement table from a catalog page (Phase 1)

This is the path the owner uses to upgrade a recall row to a
catalog-sourced or field-verified one, per non-negotiable rule 5
(inch column is the value of record) and the importer's supersede-
not-edit behavior (master prompt §3.3):

1. Add or replace the CSV under `/data/sources/recall/` or
   `/data/sources/pocket-tradesman/` — same filename, new content, or
   a new filename mapped in `scripts/field-mode/lib/table-map.ts` if
   it's a new source.
2. Keep every existing column; add new ones if the new source has
   more detail. Column names mirror the new CSV's header exactly — do
   not rename to match the old table's columns.
3. Re-run `npx tsx scripts/field-mode/gen-migration.ts` and diff the
   output against `supabase/migrations/20260829_field_mode_reference_tables.sql`.
   If the column set changed, hand-write a new dated migration adding
   the new column(s) — the generator's output is a starting point,
   not something re-applied wholesale to a table that already has
   data (it uses `CREATE TABLE IF NOT EXISTS`, so it will not touch
   rows, but a changed column list needs its own `ALTER TABLE`).
4. Re-run the importer for just that table:
   `npx tsx scripts/field-mode/import-reference-data.ts --table <table>`.
   Because the file hash changed, the importer supersedes (not edits)
   the old batch's rows via `superseded_by_batch`, so verification
   history on rows that carried over conceptually is preserved on the
   old, now-superseded rows — see the Phase 1 completion notes for why
   a new batch does not auto-inherit verification onto its own rows.
5. Set `edition` and `source_doc` in the new CSV to the real catalog
   page/standard — `UNSPECIFIED-verify` or a recall description is
   only for owner-supplied recall data.

## How to add a calculator (Phase 2 — not yet built)

## How to add a locale (Phase 2/3 — not yet built)

## Verifying reference rows (Phase 1)

Until the in-app verification console (`PFOS_FIELD_REF_VERIFY_CONSOLE`,
Phase 3+) exists, use the CLI:

```
npx tsx scripts/field-mode/verify-ref.ts \
  --table ref_flanges \
  --filter "flange_class=300,nps=6" \
  --by "RN" \
  --against "Blue Book p.42"
```

`--filter` keys are literal database column names for `--table`, not
CSV headers or aliases. See `scripts/field-mode/verify-ref.ts`'s
header comment for the full role-gate rationale.

## Known gaps and deferred items

See `DATA_SOURCE_MANIFEST.md`.
