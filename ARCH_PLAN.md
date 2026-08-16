# ARCH_PLAN.md — PipeField OS International Standards Architecture Plan

**Phase:** 1 of 3
**Date:** 2026-08-15
**Pre-requisite:** `PHASE_0_FINDINGS.md` — APPROVED
**Status:** AWAITING `APPROVED: PHASE 1` before any code is written

---

## Guiding Principles

1. **Additive-first** — new columns/tables are nullable or have safe defaults; no existing row breaks.
2. **Backwards-compatible API** — all existing API routes continue to work unchanged; new fields are optional extensions.
3. **Feature-flag gated** — every Phase 2 behaviour is behind a flag so production is never broken mid-delivery.
4. **No big-bang migrations** — each sprint item ships as an independent, reviewable PR with its own migration.
5. **Fix incidental risks first** — R2 and R3 are high-severity and touch no UI; ship them in Sprint 0 before any standards work.

---

## Delivery Sequence

```
Sprint 0  — Risk fixes (R2 NDE seed, R3 turnover stub, R4 flag type)   [~1 day]
Sprint 1  — Project & org config (governing code, jurisdiction, units)   [~2 days]
Sprint 2  — Pipe dimension API + SI support                             [~2 days]
Sprint 3  — Welder qualification essential variable expansion            [~3 days]
Sprint 4  — Material traceability (EN 10204 cert type, doc hash)        [~2 days]
Sprint 5  — Signature content hash + append-only triggers               [~1 day]
Sprint 6  — Turnover PDF generation (real package)                      [~3 days]
Sprint 7  — Per-tenant feature flags                                    [~2 days]
Sprint 8  — i18n infrastructure scaffolding                             [~3 days]
Sprint 9  — NDE personnel qualification model                           [~3 days]
Phase 3   — Rule engine + jurisdiction profiles                         [separate]
```

---

## Sprint 0 — Incidental Risk Fixes

### S0-1: Fix NDE seed non-reproducibility (Risk R2)

**File:** `src/intelligence/nde-engine.ts`

**Problem:** Seed includes `date` string → different day = different NDE selection for same weld.

**Fix:** Remove date from seed. Seed = SHA-256(`org_id + weld_id`). Store the seed value in a new column so any re-run uses the original seed.

**Migration:**
```sql
-- supabase/migrations/20260815_nde_seed_column.sql
ALTER TABLE nde_selections ADD COLUMN IF NOT EXISTS seed_hex TEXT;
-- Backfill: set seed_hex = encode(sha256((org_id::text || weld_id::text)::bytea), 'hex')
UPDATE nde_selections
SET seed_hex = encode(sha256((org_id::text || weld_id::text)::bytea), 'hex')
WHERE seed_hex IS NULL;
```

**Code change:**
```typescript
// nde-engine.ts — generateSeed()
// OLD: hash(org_id + weld_id + new Date().toDateString())
// NEW:
export function generateSeed(orgId: string, weldId: string): string {
  return crypto.createHash('sha256').update(orgId + weldId).digest('hex')
}
// On first selection: persist seed_hex to nde_selections row
// On re-run: fetch existing seed_hex from row; use that
```

---

### S0-2: Fix turnover package stub (Risk R3)

**File:** `src/app/api/turnover/generate/route.ts`

**Problem:** Always returns 200 with DB record but never generates a file. `storage_path` is always null.

**Fix (interim):** Return 501 Not Implemented with a clear error body until Sprint 6 ships the real generator. Do not silently succeed.

```typescript
// route.ts
return NextResponse.json(
  { error: 'Turnover PDF generation not yet implemented. Coming in Sprint 6.' },
  { status: 501 }
)
```

This prevents client code from showing a false "success" and sets up a clean integration point for Sprint 6.

---

### S0-3: Fix continuityWindow flag type (Risk R4)

**File:** `src/intelligence/flags.ts`

**Problem:** `NEXT_PUBLIC_CONTINUITY_WINDOW` defaults to string `"ENGINEERING_REVIEW_REQUIRED"`. Any `parseInt()` → `NaN`.

**Fix:** Separate concerns — use a boolean flag for enforcement on/off, and a numeric flag for the window in days.

```typescript
// flags.ts
export const flags = {
  // ...
  continuityEnforcement: process.env.NEXT_PUBLIC_CONTINUITY_ENFORCE === 'true',
  continuityWindowDays:  parseInt(process.env.NEXT_PUBLIC_CONTINUITY_DAYS ?? '180', 10),
  // Remove: continuityWindow: process.env.NEXT_PUBLIC_CONTINUITY_WINDOW
}
```

Update `.env.example` and Vercel env vars accordingly.

---

## Sprint 1 — Project & Org Configuration

### S1-1: Add governing code, jurisdiction, unit system to projects

**Migration:**
```sql
-- supabase/migrations/20260815_project_standards_config.sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS governing_code      TEXT,     -- e.g. 'ASME B31.3-2022'
  ADD COLUMN IF NOT EXISTS governing_code_year INTEGER,  -- e.g. 2022
  ADD COLUMN IF NOT EXISTS jurisdiction        TEXT,     -- e.g. 'US-TX', 'CA-AB', 'GB', 'AU'
  ADD COLUMN IF NOT EXISTS unit_system         TEXT      -- 'imperial' | 'si' | 'mixed'
    DEFAULT 'imperial' CHECK (unit_system IN ('imperial','si','mixed')),
  ADD COLUMN IF NOT EXISTS locale              TEXT      -- BCP-47: 'en-US', 'fr-CA', 'en-GB'
    DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS ahj                 TEXT,     -- Authority Having Jurisdiction (free text)
  ADD COLUMN IF NOT EXISTS page_size           TEXT      -- 'A4' | 'letter'
    DEFAULT 'letter' CHECK (page_size IN ('A4','letter'));
```

### S1-2: Add code registry table

A lookup table of known standard editions, so the project `governing_code` can be validated.

```sql
-- supabase/migrations/20260815_code_registry.sql
CREATE TABLE IF NOT EXISTS code_registry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard    TEXT NOT NULL,       -- 'ASME B31.3'
  edition     TEXT NOT NULL,       -- '2022'
  label       TEXT NOT NULL,       -- 'ASME B31.3-2022 Process Piping'
  region      TEXT[],              -- ['US', 'CA', 'MX'] — NULL = global
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (standard, edition)
);

-- Seed data
INSERT INTO code_registry (standard, edition, label, region) VALUES
  ('ASME B31.3', '2022', 'ASME B31.3-2022 Process Piping', NULL),
  ('ASME B31.3', '2020', 'ASME B31.3-2020 Process Piping', NULL),
  ('ASME B31.1', '2022', 'ASME B31.1-2022 Power Piping', NULL),
  ('ASME B31.1', '2020', 'ASME B31.1-2020 Power Piping', NULL),
  ('CSA Z662',   '23',   'CSA Z662-23 Oil and Gas Pipeline Systems', ARRAY['CA']),
  ('EN 13480',   '2017', 'EN 13480-2017 Metallic Industrial Piping', ARRAY['GB','EU']),
  ('AS 4041',    '2006', 'AS 4041-2006 Pressure Piping', ARRAY['AU']),
  ('ASME B36.10M','2018','ASME B36.10M-2018 Welded and Seamless Wrought Steel Pipe', NULL),
  ('ASME B36.10M','2015','ASME B36.10M-2015 Welded and Seamless Wrought Steel Pipe', NULL),
  ('ASME B36.19M','2018','ASME B36.19M-2018 Stainless Steel Pipe', NULL);
```

### S1-3: Expose project config in UI

**Files to create/modify:**
- `src/app/api/projects/[id]/standards/route.ts` — PATCH endpoint for standards fields
- `src/components/projects/ProjectStandardsCard.tsx` — new card in project settings page
- `src/hooks/useCodeRegistry.ts` — fetch `code_registry` for select dropdowns

**ProjectStandardsCard fields:**
- Governing Code (searchable select from `code_registry`)
- Jurisdiction (text input with country/state suggestions)
- Unit System (imperial / SI / mixed radio)
- Locale (select: en-US, en-GB, fr-CA, de-DE, pt-BR, es-MX, ar-SA, zh-CN)
- AHJ (free text)
- Page Size (A4 / Letter radio)

---

## Sprint 2 — Pipe Dimension API + SI Support

### S2-1: Serve pipe dimensions from an API endpoint

**Problem:** Dimensions bundled as JSON at build time — no way to query, update, or audit.

**New file:** `src/app/api/pipe-dimensions/route.ts`

```typescript
// GET /api/pipe-dimensions?standard=B36.10M&nps=4&schedule=SCH40&units=si
// Returns: { OD, wall, ID } in requested unit system
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const standard  = searchParams.get('standard') ?? 'B36.10M'
  const nps       = searchParams.get('nps')
  const schedule  = searchParams.get('schedule')
  const units     = searchParams.get('units') ?? 'imperial'  // 'imperial' | 'si'

  // Load from JSON (Sprint 2), later from DB (Phase 3)
  const data = getDimensions(standard, nps, schedule)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (units === 'si') {
    return NextResponse.json({
      OD_mm:   inToMm(data.OD_in),
      wall_mm: inToMm(data.wall_in),
      ID_mm:   inToMm(data.ID_in),
      DN:      npsToDN(nps),
      unit_system: 'si'
    })
  }
  return NextResponse.json({ ...data, unit_system: 'imperial' })
}
```

### S2-2: Add DN field and SI dimensions to JSON

**File:** `src/data/asme_pipe_dimensions.json`

Add `DN_mm` and `OD_mm` at each NPS level. All existing `OD_in`/`wall_in`/`ID_in` fields remain.

```json
"4.0": {
  "OD_in": 4.500,
  "OD_mm": 114.3,
  "DN_mm": 100,
  "schedules": {
    "SCH40": {
      "wall_in": 0.237,
      "wall_mm": 6.02,
      "ID_in": 4.026,
      "ID_mm": 102.26
    }
  }
}
```

**Script to generate:** `scripts/add_si_fields.py`
```python
IN_TO_MM = 25.4
NPS_TO_DN = { "0.5":15, "0.75":20, "1":25, "1.25":32, "1.5":40,
              "2":50, "2.5":65, "3":80, "3.5":90, "4":100, ... }
```

### S2-3: Unit conversion utility

**New file:** `src/lib/units.ts`

```typescript
export const IN_TO_MM = 25.4
export const FT_TO_M  = 0.3048
export const LB_TO_KG = 0.453592
export const PSI_TO_BAR = 0.0689476
export const F_TO_C = (f: number) => (f - 32) * 5/9

export function inToMm(inches: number) { return +(inches * IN_TO_MM).toFixed(3) }
export function mmToIn(mm: number)     { return +(mm / IN_TO_MM).toFixed(4) }
export function ftToM(ft: number)      { return +(ft * FT_TO_M).toFixed(3) }
export function psiToBar(psi: number)  { return +(psi * PSI_TO_BAR).toFixed(3) }
export function lbftToKgm(lbft: number){ return +(lbft * LB_TO_KG / FT_TO_M).toFixed(3) }

export type UnitSystem = 'imperial' | 'si'
export function formatLength(val: number, sys: UnitSystem) {
  return sys === 'si' ? `${inToMm(val)} mm` : `${val.toFixed(3)}"`
}
```

---

## Sprint 3 — Welder Qualification Essential Variables

### S3-1: Extend welder_qualifications schema

```sql
-- supabase/migrations/20260815_welder_qual_essential_vars.sql
ALTER TABLE welder_qualifications
  ADD COLUMN IF NOT EXISTS p_number_base     TEXT,    -- QW-422 P-No (e.g. 'P1', 'P8')
  ADD COLUMN IF NOT EXISTS f_number          TEXT,    -- QW-432 F-No (e.g. 'F3', 'F6')
  ADD COLUMN IF NOT EXISTS a_number          TEXT,    -- QW-442 A-No
  ADD COLUMN IF NOT EXISTS thickness_min_in  NUMERIC, -- qualified thickness range lower
  ADD COLUMN IF NOT EXISTS thickness_max_in  NUMERIC, -- qualified thickness range upper
  ADD COLUMN IF NOT EXISTS od_min_in         NUMERIC, -- qualified OD range lower (pipe)
  ADD COLUMN IF NOT EXISTS od_max_in         NUMERIC, -- qualified OD range upper
  ADD COLUMN IF NOT EXISTS pwht_required     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_required   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS continuity_last_weld_date DATE, -- for QW-322 6-month check
  ADD COLUMN IF NOT EXISTS standard          TEXT DEFAULT 'ASME IX'; -- 'ASME IX' | 'API 1104'
```

### S3-2: Position coverage expansion table

```sql
CREATE TABLE IF NOT EXISTS position_coverage (
  tested_position   TEXT PRIMARY KEY,  -- '6G', '2G', etc.
  covers            TEXT[]             -- positions this qual covers
);

INSERT INTO position_coverage (tested_position, covers) VALUES
  ('1G',  ARRAY['1G']),
  ('2G',  ARRAY['1G','2G']),
  ('3G',  ARRAY['1G','3G','4G']),
  ('4G',  ARRAY['1G','4G']),
  ('3G+4G', ARRAY['1G','3G','4G']),
  ('6G',  ARRAY['1G','2G','3G','4G','5G','6G']),  -- all positions
  ('6GR', ARRAY['1G','2G','3G','4G','5G','6G','6GR']),
  ('1F',  ARRAY['1F']),
  ('2F',  ARRAY['1F','2F']),
  ('3F',  ARRAY['1F','2F','3F','4F']),
  ('4F',  ARRAY['1F','2F','4F']),
  ('2F+3F', ARRAY['1F','2F','3F','4F']);
```

### S3-3: Update qualification-engine.ts

**File:** `src/intelligence/qualification-engine.ts`

Replace exact-match position check with coverage expansion. Add thickness, OD, and P-number checks.

```typescript
// checkQualification() updated logic:
export async function checkQualification(
  welderId: string,
  weldParams: {
    process: string
    position: string
    pNumber?: string
    wallThickness_in?: number
    od_in?: number
    pwht?: boolean
  }
): Promise<QualificationResult> {
  const quals = await fetchActiveQuals(welderId)

  for (const q of quals) {
    // 1. Process match (exact)
    if (q.process !== weldParams.process) continue

    // 2. Position coverage (expanded)
    const coverage = await getPositionCoverage(q.position)
    if (!coverage.includes(weldParams.position)) continue

    // 3. Thickness range (if provided)
    if (weldParams.wallThickness_in !== undefined) {
      if (q.thickness_min_in && weldParams.wallThickness_in < q.thickness_min_in) continue
      if (q.thickness_max_in && weldParams.wallThickness_in > q.thickness_max_in) continue
    }

    // 4. OD range (if provided)
    if (weldParams.od_in !== undefined && q.od_min_in) {
      if (weldParams.od_in < q.od_min_in) continue
    }

    // 5. P-number (if provided and qual has P-number)
    if (weldParams.pNumber && q.p_number_base) {
      if (!pNumberCovers(q.p_number_base, weldParams.pNumber)) continue
    }

    // 6. Continuity check (QW-322)
    if (flags.continuityEnforcement && q.continuity_last_weld_date) {
      const daysSince = daysBetween(q.continuity_last_weld_date, new Date())
      if (daysSince > flags.continuityWindowDays) {
        return { qualified: false, reason: 'CONTINUITY_LAPSED', qual: q }
      }
    }

    return { qualified: true, matchedQual: q }
  }

  return { qualified: false, reason: 'NO_MATCHING_QUALIFICATION' }
}
```

**New file:** `src/intelligence/p-number-coverage.ts` — P-number grouping table (P1 covers P1; P8 covers P8; etc. per QW-422).

**Add to `RULES_REQUIRING_VERIFICATION.md`:**
> RULE-001: Position coverage expansion table — verify 6G covers all positions per ASME IX QW-461.9 before enabling `qualificationEnforcement=true`.
> RULE-002: P-number grouping — verify P-number coverage table against ASME IX QW-422 before enabling enforcement.
> RULE-003: Thickness range calculation — verify 2T rule (double the test thickness as max) against ASME IX QW-451 before enabling.

---

## Sprint 4 — Material Traceability

### S4-1: Add EN 10204 cert type enum

```sql
-- supabase/migrations/20260815_mtr_cert_type.sql
ALTER TABLE mtrs
  ADD COLUMN IF NOT EXISTS cert_type_enum TEXT
    CHECK (cert_type_enum IN ('2.1','2.2','3.1','3.2'))
    DEFAULT NULL;

-- Retain free-text cert_type for backwards compat; new UI writes cert_type_enum
```

### S4-2: Add document hash to mtrs

```sql
ALTER TABLE mtrs
  ADD COLUMN IF NOT EXISTS document_sha256 TEXT, -- hex SHA-256 of uploaded PDF bytes
  ADD COLUMN IF NOT EXISTS document_size_bytes BIGINT;
```

**Implementation:** Compute SHA-256 in the browser before upload (`crypto.subtle.digest`); send hash alongside file. API verifies hash matches stored file after upload.

### S4-3: Add PMI table

```sql
CREATE TABLE IF NOT EXISTS pmi_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  project_id      UUID REFERENCES projects(id),
  weld_id         UUID REFERENCES welds(id),
  heat_number     TEXT,
  method          TEXT CHECK (method IN ('XRF','OES','wet_chem')),
  result_alloy    TEXT,    -- e.g. 'A312 TP316L'
  result_data     JSONB,   -- raw elemental percentages
  performed_by    TEXT,
  performed_at    TIMESTAMPTZ,
  pass            BOOLEAN,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### S4-4: Project-level cert type requirement

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS required_cert_type TEXT
    CHECK (required_cert_type IN ('2.1','2.2','3.1','3.2','none'))
    DEFAULT 'none';
```

---

## Sprint 5 — Signature Content Hash + Append-Only Triggers

### S5-1: Add content_hash to signatures

```sql
-- supabase/migrations/20260815_signature_content_hash.sql
ALTER TABLE signatures
  ADD COLUMN IF NOT EXISTS content_hash TEXT,  -- SHA-256 of signed document bytes
  ADD COLUMN IF NOT EXISTS content_type TEXT,  -- 'weld_record' | 'test_package' | 'mtr'
  ADD COLUMN IF NOT EXISTS content_version INTEGER;
```

**Client flow:** Before presenting signature pad, hash the serialised record (JSON canonicalised). Store hash alongside signature. On verification: re-hash current record, compare to `content_hash` → detect tampering.

### S5-2: DB trigger — prevent UPDATE on signatures

```sql
-- supabase/migrations/20260815_signature_immutable_trigger.sql
CREATE OR REPLACE FUNCTION prevent_signature_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signatures are immutable; insert a new row instead';
END;
$$;

CREATE TRIGGER signatures_immutable
  BEFORE UPDATE ON signatures
  FOR EACH ROW EXECUTE FUNCTION prevent_signature_update();
```

### S5-3: DB trigger — prevent UPDATE/DELETE on audit_logs

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```

---

## Sprint 6 — Turnover PDF Generation

### S6-1: Real turnover package generator

**Files:**
- `src/lib/turnover/builder.ts` — assembles package contents
- `src/lib/turnover/pdf-renderer.ts` — renders PDF via `@react-pdf/renderer`
- `src/components/pdf/TurnoverCoverSheet.tsx`
- `src/components/pdf/WeldIndex.tsx`
- `src/components/pdf/NdeIndex.tsx`
- `src/components/pdf/MtrIndex.tsx`
- `src/components/pdf/PressureTestIndex.tsx`

**Package structure:**
```
Turnover Package
├── Cover Sheet (project, governing code, jurisdiction, date)
├── Section 1: Weld Index (weld no., spool, size, process, welder, status)
├── Section 2: NDE Summary (weld no., method, result, report ref)
├── Section 3: MTR Index (heat no., spec, cert type, cert ref)
├── Section 4: Pressure Test Records (test no., circuit, test pressure, result)
└── Section 5: Signature Sheet (QC engineer, client, AHJ)
```

**Page size:** Read from `project.page_size` (Sprint 1). Default `'letter'`.

**Route update:** `src/app/api/turnover/generate/route.ts`
- Generate PDF buffer server-side
- Upload to Supabase Storage at `turnover/{org_id}/{project_id}/{package_id}.pdf`
- Update `turnover_packages.storage_path` with the storage path
- Return signed URL to client

### S6-2: Migration

```sql
-- supabase/migrations/20260815_turnover_packages_v2.sql
ALTER TABLE turnover_packages
  ADD COLUMN IF NOT EXISTS generated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_by      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS page_count        INTEGER,
  ADD COLUMN IF NOT EXISTS weld_count        INTEGER,
  ADD COLUMN IF NOT EXISTS document_sha256   TEXT;
```

---

## Sprint 7 — Per-Tenant Feature Flags

### S7-1: org_feature_flags table

```sql
-- supabase/migrations/20260815_org_feature_flags.sql
CREATE TABLE IF NOT EXISTS org_feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  flag_name  TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  metadata   JSONB,     -- e.g. { "continuityWindowDays": 180 }
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, flag_name)
);

-- RLS: org members can read; only org admins can write
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_flags_read" ON org_feature_flags
  FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_flags_write" ON org_feature_flags
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### S7-2: Flag resolution hook

**New file:** `src/hooks/useOrgFlags.ts`

```typescript
// Resolution order: org_feature_flags DB row > process env var > hard default
export function useOrgFlags(): ResolvedFlags {
  const { org } = useOrg()
  const { data: dbFlags } = useSWR(`/api/org/${org.id}/flags`)

  return useMemo(() => resolveFlags(dbFlags, processEnvFlags), [dbFlags])
}
```

**New file:** `src/app/api/org/[id]/flags/route.ts` — returns org's flag overrides.

### S7-3: Admin flag UI

**New page:** `src/app/(dashboard)/settings/feature-flags/page.tsx`
- Lists all 23 flags with toggle switches
- Numeric inputs for flags with `metadata` values (e.g. continuity window days)
- "Inherited from system" badge when no org override exists

---

## Sprint 8 — i18n Infrastructure

### S8-1: Install and configure next-intl

```bash
npm install next-intl
```

**Files:**
- `src/i18n/request.ts` — locale detection (project.locale > org.locale > browser Accept-Language > 'en-US')
- `src/i18n/routing.ts` — locale routing config (no URL prefix; locale stored in user prefs)
- `messages/en-US.json` — English source strings
- `messages/fr-CA.json` — French Canadian (stub)
- `messages/en-GB.json` — British English (stub; mainly date/unit formatting differs)

### S8-2: String extraction strategy

Do **not** attempt to extract all 2,000+ strings at once.

Phased extraction order (highest-ROI first):
1. PDF report labels (affects regulatory submissions immediately)
2. Error messages (qualification errors, NDE failures)
3. Form labels in project settings and weld entry
4. Navigation and page titles
5. Everything else

**New file:** `scripts/extract_strings.ts` — AST walk of all TSX files; outputs a report of all inline string literals not yet in `messages/`.

### S8-3: Date/number formatting utility

**New file:** `src/lib/format.ts`

```typescript
import { useFormatter, useLocale } from 'next-intl'

// Wraps next-intl formatter with project unit system awareness
export function usePipeFormatter() {
  const fmt = useFormatter()
  const { project } = useProject()

  return {
    length: (val_in: number) =>
      project.unit_system === 'si'
        ? `${fmt.number(inToMm(val_in), { maximumFractionDigits: 1 })} mm`
        : `${fmt.number(val_in, { maximumFractionDigits: 3 })}"`,
    pressure: (val_psi: number) =>
      project.unit_system === 'si'
        ? `${fmt.number(psiToBar(val_psi), { maximumFractionDigits: 2 })} bar`
        : `${fmt.number(val_psi, { maximumFractionDigits: 0 })} psi`,
    date: (d: Date | string) => fmt.dateTime(new Date(d), { dateStyle: 'medium' }),
  }
}
```

---

## Sprint 9 — NDE Personnel Qualification

### S9-1: NDE personnel table

```sql
-- supabase/migrations/20260815_nde_personnel.sql
CREATE TABLE IF NOT EXISTS nde_personnel (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id),
  name          TEXT NOT NULL,
  certification_body TEXT,  -- 'ASNT SNT-TC-1A' | 'CSWIP' | 'PCN' | 'COFREND'
  cert_number   TEXT,
  methods       TEXT[],     -- ARRAY['RT','UT','MT','PT']
  level         TEXT CHECK (level IN ('I','II','III')),
  expiry_date   DATE,
  employer      TEXT,       -- employer at time of cert (SNT-TC-1A is employer-based)
  vision_test_date DATE,    -- annual vision test (Jaeger No. 2 / Snellen)
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### S9-2: Link NDE selection to NDE personnel

```sql
ALTER TABLE nde_selections
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES nde_personnel(id),
  ADD COLUMN IF NOT EXISTS personnel_level TEXT;  -- denormalised at time of assignment
```

### S9-3: NDE personnel qualification check

```typescript
// src/intelligence/nde-engine.ts — addPersonnelCheck()
export async function checkNdePersonnel(
  personnelId: string,
  method: 'RT' | 'UT' | 'MT' | 'PT'
): Promise<{ qualified: boolean; reason?: string }> {
  const p = await fetchPersonnel(personnelId)
  if (!p) return { qualified: false, reason: 'NOT_FOUND' }
  if (!p.methods.includes(method)) return { qualified: false, reason: 'METHOD_NOT_COVERED' }
  if (p.level === 'I') return { qualified: false, reason: 'LEVEL_I_CANNOT_INTERPRET' }
  if (p.expiry_date && new Date(p.expiry_date) < new Date())
    return { qualified: false, reason: 'CERT_EXPIRED' }
  if (p.vision_test_date) {
    const daysSince = daysBetween(p.vision_test_date, new Date())
    if (daysSince > 365) return { qualified: false, reason: 'VISION_TEST_OVERDUE' }
  }
  return { qualified: true }
}
```

---

## File Change Summary

### New files
| File | Sprint |
|------|--------|
| `supabase/migrations/20260815_nde_seed_column.sql` | S0 |
| `supabase/migrations/20260815_project_standards_config.sql` | S1 |
| `supabase/migrations/20260815_code_registry.sql` | S1 |
| `supabase/migrations/20260815_welder_qual_essential_vars.sql` | S3 |
| `supabase/migrations/20260815_mtr_cert_type.sql` | S4 |
| `supabase/migrations/20260815_signature_content_hash.sql` | S5 |
| `supabase/migrations/20260815_signature_immutable_trigger.sql` | S5 |
| `supabase/migrations/20260815_org_feature_flags.sql` | S7 |
| `supabase/migrations/20260815_nde_personnel.sql` | S9 |
| `src/app/api/pipe-dimensions/route.ts` | S2 |
| `src/app/api/org/[id]/flags/route.ts` | S7 |
| `src/app/api/projects/[id]/standards/route.ts` | S1 |
| `src/app/(dashboard)/settings/feature-flags/page.tsx` | S7 |
| `src/lib/units.ts` | S2 |
| `src/lib/format.ts` | S8 |
| `src/lib/turnover/builder.ts` | S6 |
| `src/lib/turnover/pdf-renderer.ts` | S6 |
| `src/components/pdf/TurnoverCoverSheet.tsx` | S6 |
| `src/components/pdf/WeldIndex.tsx` | S6 |
| `src/components/pdf/NdeIndex.tsx` | S6 |
| `src/components/projects/ProjectStandardsCard.tsx` | S1 |
| `src/hooks/useOrgFlags.ts` | S7 |
| `src/hooks/useCodeRegistry.ts` | S1 |
| `src/intelligence/p-number-coverage.ts` | S3 |
| `src/i18n/request.ts` | S8 |
| `messages/en-US.json` | S8 |
| `scripts/add_si_fields.py` | S2 |
| `scripts/extract_strings.ts` | S8 |

### Modified files
| File | Change | Sprint |
|------|--------|--------|
| `src/intelligence/nde-engine.ts` | Fix seed; add personnel check | S0, S9 |
| `src/intelligence/qualification-engine.ts` | Essential variable expansion | S3 |
| `src/intelligence/flags.ts` | Split continuityWindow flag | S0 |
| `src/app/api/turnover/generate/route.ts` | 501 stub → real generator | S0, S6 |
| `src/data/asme_pipe_dimensions.json` | Add DN_mm, OD_mm, wall_mm, ID_mm | S2 |
| `pipefield_os/data/asme_pipe_dimensions.json` | Mirror of above | S2 |

---

## RULES_REQUIRING_VERIFICATION.md Additions

```
RULE-001: Position coverage expansion table
  Verify 6G covers all positions per ASME IX QW-461.9 before enabling qualificationEnforcement.

RULE-002: P-number grouping table
  Verify P-number coverage against ASME IX QW-422 before enabling.

RULE-003: Thickness range calculation (2T rule)
  Verify max qualified thickness = 2× test coupon thickness per ASME IX QW-451.

RULE-004: NDE percentage tables (B31.3 Normal/Category D/High-pressure)
  Verify against ASME B31.3 Table 341.3.2 and 341.4.1 before enabling ndeEnabled.

RULE-005: Continuity window (180 days)
  Verify against ASME IX QW-322.1(a) — confirm 6-calendar-month interpretation.
```

---

## Phase 3 Preview (Not Yet Planned)

Phase 3 will cover:
- **Rule engine** — jurisdiction-aware rule sets (B31.3 Normal vs Category M vs High-pressure; CSA Z662 Classes 1–4)
- **Multi-language PDF output** — full translation of all PDF templates
- **Offline timezone metadata** — store UTC offset + IANA timezone on every offline-created record
- **Sync conflict resolution UI** — show user when their write was discarded; allow manual merge

---

## Next Step

**STOP. Awaiting `APPROVED: PHASE 1` before writing any code.**

On approval, begin with Sprint 0 (risk fixes — no migrations, no UI changes; pure logic fixes that can ship immediately).
