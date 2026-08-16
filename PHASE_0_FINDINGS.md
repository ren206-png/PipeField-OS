# PHASE 0 FINDINGS — PipeField OS International Standards Architecture Audit

**Date:** 2026-08-15
**Auditor:** Claude (read-only inventory; no code changed)
**Scope:** Full codebase snapshot at HEAD
**Status:** AWAITING `APPROVED: PHASE 0` before any implementation begins

---

## A. Standard References Inventory

All ASME / API / ISO / EN / BS references found in source files.

| Reference | File(s) | Context |
|-----------|---------|---------|
| ASME B36.10M | `src/data/asme_pipe_dimensions.json`, `pipefield_os/data/asme_pipe_dimensions.json`, `src/config/pipe-data.ts`, `src/components/pipe-support/InputForm.tsx` (line 93) | Pipe dimension dataset; user-selectable standard in Pipe Support form |
| ASME B36.19M | same JSON files, `InputForm.tsx` | Stainless schedules |
| ASME B31.3 | `InputForm.tsx` line 15 (`DESIGN_BASES`), `pipefield_os/pipe_support/engine.py` | Process piping design basis selector |
| ASME B31.1 | `InputForm.tsx` line 15, `engine.py` | Power piping design basis |
| ASME B16.9 | `src/app/(dashboard)/calculator/page.tsx` (engineering notice banner) | Reference only; no data table |
| ASME IX | `src/intelligence/qualification-engine.ts` comments | Welder qualification process codes |
| API 1104 | `src/intelligence/qualification-engine.ts` comments | Pipeline welding reference (comment only) |
| ASME B&PV Sec I | Implicit via B31.1 reference in engine.py | Not explicitly cited |

**Edition tracking:** None. No `edition_year` or `edition` field exists on any record or in the JSON data. The standard name is stored but not the edition year (e.g., "B36.10M-2015" vs "B36.10M-2004").

---

## B. Welder Qualification Schema & Logic

### Schema (from Supabase migrations)
```
welders
  id, org_id, name, badge_number, created_at

welder_qualifications
  id, welder_id, org_id
  process          TEXT   (e.g. "SMAW", "GTAW")
  position         TEXT   (e.g. "1G", "6G")
  base_metal       TEXT
  filler_metal     TEXT
  qualified_date   DATE
  expiry_date      DATE
  test_number      TEXT
  notes            TEXT
  created_at
```

### Evaluation Logic (`src/intelligence/qualification-engine.ts`)
`checkQualification(welderId, weldParams)` performs:
1. Fetch all qualifications for welder where `expiry_date > now()`
2. Filter by `process` match (exact string comparison)
3. Filter by `position` match (exact string comparison — **no essential variable expansion**)
4. Returns `{ qualified: boolean, matchedQual: ... }`

### Gaps
- ❌ No thickness range enforcement (essential variable per ASME IX QW-403)
- ❌ No diameter range enforcement (QW-403.18 for pipe)
- ❌ No P-number / F-number / A-number grouping
- ❌ No essential vs. supplementary essential variable classification
- ❌ No PWHT condition tracking
- ❌ No impact test condition
- ❌ No 6-month continuity check (QW-322) — `continuity_window` env var exists but defaults to `ENGINEERING_REVIEW_REQUIRED` string (see Risk R4)
- ❌ No API 1104 qualification path
- ❌ Position coverage expansion not implemented (e.g., 6G covers all positions)

---

## C. NDE Selection Engine

### Location
`src/intelligence/nde-engine.ts` (and mirrored in `pipefield_os/intelligence/`)

### Logic
- Percentage-based random selection seeded with SHA-256 hash of `(org_id + weld_id + date)`
- Fluid service category drives RT/UT/MT/PT percentage tables
- Design basis (B31.3 vs B31.1) selects different percentage tables

### Gaps
- ❌ No NDE personnel qualification model (SNT-TC-1A / ASME Sec V Art. 1 T-120)
- ❌ SHA-256 seed incorporates `date` — **non-reproducible** if re-run on different day (Risk R2)
- ❌ No radiographic technique record (source, SFD, IQI)
- ❌ No hardness testing (PWHT verification)
- ❌ No hold-point / witness-point workflow
- ❌ Severity of indication / acceptance criteria not stored — pass/fail only

---

## D. Material Traceability

### Schema
```
mtrs (Material Test Reports)
  id, org_id, project_id
  heat_number      TEXT
  material_spec    TEXT   (e.g. "A106 Gr B")
  cert_type        TEXT   (free text — no enum)
  issued_by        TEXT
  document_url     TEXT
  created_at

welds
  heat_number_base TEXT
  heat_number_fill TEXT
  (FK to mtrs via heat_number — soft link, no FK constraint)
```

### Gaps
- ❌ No EN 10204 certificate type enum (2.1 / 2.2 / 3.1 / 3.2)
- ❌ No document hash / SHA-256 fingerprint on uploaded certs
- ❌ No PMI (Positive Material Identification) record table
- ❌ No traceability chain: MR → spool → weld (heat_number is a free-text soft link)
- ❌ No mill cert expiry / validity period
- ❌ `cert_type` is free text — cannot enforce 3.1 vs 3.2 by project requirement

---

## E. Pipe Dimension Dataset

### Files
- `src/data/asme_pipe_dimensions.json` — Next.js app source of truth
- `pipefield_os/data/asme_pipe_dimensions.json` — Python backend mirror
- `src/config/pipe-data.ts` — TypeScript typed lookup tables

### Coverage (post-expansion this session)
- B36.10M: NPS 0.5 → 60 (33 sizes, no gaps in 24–48 range)
- B36.19M: NPS 0.5 → 12 (stainless schedules)

### Structure
```json
{
  "B36.10M": {
    "<NPS>": {
      "OD_in": 4.500,
      "schedules": {
        "SCH40": { "wall_in": 0.237, "ID_in": 4.026 }
      }
    }
  }
}
```

### Gaps
- ❌ All dimensions in **inches only** — no DN (mm) field
- ❌ No `edition_year` per row or per standard block
- ❌ No database table — JSON file only (cannot query, no audit trail on changes)
- ❌ No API endpoint serving pipe dimensions (UI reads bundled JSON at build time)
- ❌ `InputForm.tsx` maintains a **second independent hardcoded `NPS_SIZES` array** (line 9) — dual-maintenance risk
- ❌ Schedules incomplete for large NPS (26+): only SCH10/SCH20/SCH40/SCH80; no SCH60/SCH100/SCH120/SCH140/SCH160/STD/XS/XXS for these sizes

---

## F. Units System

### Current State
- All pipe dimensions: **inches** (hard-coded)
- All span outputs: **feet** (hard-coded)
- Pressure: **PSI** (hard-coded in pressure_tests schema)
- Temperature: **°F** (hard-coded in thermal expansion panel)
- Weight: **lb/ft** (hard-coded)

### Per-record unit fields found
```
pressure_tests.pressure_unit   TEXT  (not enforced — free text)
mtrs.unit_system               TEXT  (not present — absent)
flanges.pressure_class         TEXT  (ANSI class — no SI)
```

### Gaps
- ❌ No global `unit_system` setting at org / project / user level
- ❌ No conversion layer — all calculations output imperial
- ❌ Temperature inputs accept numeric only; no unit label stored
- ❌ PDF reports have no unit labels on some fields
- ❌ No SI storage format (DN, bar, mm, °C, N/mm²)

---

## G. Internationalization (i18n)

### Current State
- **Zero i18n infrastructure** — no `next-intl`, `react-i18next`, `i18next`, or similar library found in `package.json` or imports
- All UI strings are inline English literals in TSX/TS files
- Estimated >2,000 user-facing string literals across components
- No `locales/` or `messages/` directory

### PDF Generation
- `@react-pdf/renderer` used for all PDF output
- All PDFs hardcoded to A4 page size
- No locale-aware date/number formatting
- All labels hardcoded in English

### Gaps
- ❌ No translation key system
- ❌ No RTL layout support
- ❌ No locale-aware number formatting (decimal separator)
- ❌ No locale-aware date formatting
- ❌ PDF page size hardcoded A4 (US projects typically use Letter)
- ❌ No `lang` attribute management on `<html>` element

---

## H. Signatures & Audit Trail

### Schema
```
signatures
  id, org_id, weld_id (or entity_id + entity_type)
  signed_by        UUID (FK → auth.users)
  role             TEXT
  signed_at        TIMESTAMPTZ
  signature_data   TEXT  (base64 image or null)
  -- No content_hash field

audit_logs
  id, org_id, user_id
  action           TEXT
  entity_type      TEXT
  entity_id        UUID
  changes          JSONB
  created_at       TIMESTAMPTZ
  -- Append-only enforced by: NO DELETE/UPDATE RLS policy (added in migration 20260805)

weld_events
  id, weld_id, org_id, actor_id
  event_type       TEXT
  payload          JSONB
  created_at       TIMESTAMPTZ
  -- True append-only: no UPDATE/DELETE columns; no RLS delete policy
```

### Gaps
- ❌ No content hash on `signatures` — cannot prove what document was signed
- ❌ No DB trigger preventing UPDATE on `audit_logs` (RLS alone is bypassable by service role)
- ❌ No DB trigger preventing UPDATE on `signatures`
- ❌ `signature_data` is nullable — signature can be recorded without actual signature image
- ❌ No PKI / certificate-based signing (only base64 image)
- ❌ No timestamping authority integration (RFC 3161)
- ✅ PARTIAL: `weld_events` is structurally append-only (no mutable columns)

---

## I. Turnover Package Generation

### Current State
- `turnover_packages` table exists:
  ```
  id, org_id, project_id
  name             TEXT
  contents         JSONB   (list of included entity IDs / types)
  storage_path     TEXT    (always NULL in practice)
  created_at
  ```
- API route `POST /api/turnover/generate` creates a DB record only
- `storage_path` is never populated — no file is actually generated or stored
- No PDF template exists for turnover packages
- No weld map, test pack index, or ITR sheet generation

### Gaps
- ❌ No PDF generation for turnover packages
- ❌ `storage_path` always null — turnover package is a DB record stub only
- ❌ No test pack / inspection and test record (ITR) structure
- ❌ No weld map generation
- ❌ No index of included welds, MTRs, NDE reports, pressure tests
- ❌ No multi-document bundle (zip) generation

---

## J. Project & Jurisdiction Configuration

### Current State
```
projects
  id, org_id, name, project_number
  description      TEXT
  status           TEXT
  created_at, updated_at

org_settings
  id, org_id
  default_design_basis  TEXT  (e.g. "B31.3")
  -- (minimal fields)
```

### Gaps
- ❌ No `governing_code` field on projects (which edition of which standard)
- ❌ No `jurisdiction` field (country / state / province)
- ❌ No `code_profile` or `standard_set` linking project to a ruleset
- ❌ No `unit_system` preference at project level
- ❌ No `language` / `locale` preference at project level
- ❌ No `authority_having_jurisdiction` (AHJ) field
- ❌ Design basis is a UI selector in `InputForm.tsx`, not stored on the project record

---

## K. Feature Flags

### Inventory (`src/intelligence/flags.ts`)

| Flag | Env Var | Default | Scope |
|------|---------|---------|-------|
| `ndeEnabled` | `NEXT_PUBLIC_NDE_ENABLED` | `false` | Process-level |
| `qualificationEnforcement` | `NEXT_PUBLIC_QUAL_ENFORCEMENT` | `false` | Process-level |
| `turnoverGeneration` | `NEXT_PUBLIC_TURNOVER_GEN` | `false` | Process-level |
| `offlineSync` | `NEXT_PUBLIC_OFFLINE_SYNC` | `false` | Process-level |
| `continuityWindow` | `NEXT_PUBLIC_CONTINUITY_WINDOW` | `ENGINEERING_REVIEW_REQUIRED` | Process-level |
| `materialTraceability` | `NEXT_PUBLIC_MTR_ENFORCE` | `false` | Process-level |
| ... (17 more) | `NEXT_PUBLIC_*` | varies | Process-level |

**Total flags found:** 23

### Gaps
- ❌ All flags are process-level (Vercel env vars) — same value for all tenants on same deployment
- ❌ No per-org / per-tenant flag override capability
- ❌ No admin UI to toggle flags without redeployment
- ❌ `NEXT_PUBLIC_*` prefix exposes all flags to browser bundle (intentional for client-side checks, but worth noting)
- ❌ `continuityWindow` default is the string `"ENGINEERING_REVIEW_REQUIRED"` — any code parsing this as a number will get `NaN` (Risk R4)

---

## L. Offline Sync & Timezone Handling

### Current State
- Offline queue stored in **IndexedDB** via custom hook (`src/hooks/useOfflineSync.ts`)
- Conflict resolution: **first-write-wins** (server record wins if it exists)
- Timestamps: client-side `new Date().toISOString()` (UTC string) at time of local write

### Gaps
- ❌ No timezone metadata stored on records — UTC offset of originating device not captured
- ❌ No server-side timestamp override on sync (client timestamp accepted as-is)
- ❌ First-write-wins can silently discard a field inspector's update if a foreman synced first
- ❌ No sync conflict log — user never sees that their write was discarded
- ❌ No vector clock or sequence number for merge ordering
- ❌ Offline queue has no TTL — stale records can sync days later with old timestamps

---

## Gap Matrix

| Capability | Status | Notes |
|------------|--------|-------|
| Multi-standard code registry (edition-tracked) | ❌ MISSING | Standard name stored; no edition year |
| Rule engine with jurisdiction profiles | ❌ MISSING | Design basis is UI-only selector |
| SI unit storage + conversion layer | ❌ MISSING | All imperial, hard-coded |
| i18n / locale framework | ❌ MISSING | Zero infrastructure |
| Jurisdiction / AHJ project config | ❌ MISSING | No governing_code on projects |
| Per-tenant feature flag scoping | ❌ MISSING | Process-level env vars only |
| Welder qual essential variable expansion | ❌ MISSING | Exact-match only |
| EN 10204 cert type enforcement | ❌ MISSING | Free text field |
| Turnover PDF generation | ❌ MISSING | DB record stub only; storage_path always null |
| Content-hashed signatures | ⚠️ PARTIAL | Signature table exists; no hash field |

---

## Incidental Risks (Non-Standards, Observed During Audit)

| ID | Risk | Location | Severity |
|----|------|----------|----------|
| R1 | Several API route handlers import `createAdminClient()` (service role key), bypassing RLS for business logic rather than admin operations | `src/app/api/welders/certifications/expiring/route.ts` and ~4 others | Medium |
| R2 | NDE seed includes current date — re-running NDE selection on a different calendar day produces different selections for the same weld set, making audits non-reproducible | `src/intelligence/nde-engine.ts` | High |
| R3 | Turnover package `storage_path` is always null; `POST /api/turnover/generate` returns 200 with a DB record but no file is ever stored | `src/app/api/turnover/generate/route.ts` | High |
| R4 | `NEXT_PUBLIC_CONTINUITY_WINDOW` defaults to string `"ENGINEERING_REVIEW_REQUIRED"` — any numeric parse (e.g., `parseInt(flag)`) yields `NaN`; continuity check silently passes or throws | `src/intelligence/flags.ts` | Medium |
| R5 | `signatures` table has no DB trigger preventing UPDATE — a service-role client can mutate a signed record without an audit trail entry | Supabase schema | Medium |
| R6 | All PDF outputs hardcode A4 page size — US jurisdictions expect Letter (8.5×11"); no per-org or per-project page size setting | `src/components/pdf/` (all files) | Low |

---

## Deliverables

- [x] `PHASE_0_FINDINGS.md` — this document
- [ ] `RULES_REQUIRING_VERIFICATION.md` — to be created (empty for Phase 0; no rules implemented yet)

---

## Next Step

**STOP. Awaiting `APPROVED: PHASE 0` before proceeding to Phase 1 (ARCH_PLAN.md).**

Phase 1 will produce a concrete implementation plan across the gap matrix items above, with file-level change specifications, migration scripts, and a sequenced delivery order.
