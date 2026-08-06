# PHASE_1_PLAN.md
## PipeField OS — Tier 1 Design: Audit-Proof Core

**Status:** Design only. Zero writes. Awaiting APPROVED: PHASE 1 before any code.  
**Feeds from:** PHASE_0_FINDINGS.md  
**Non-negotiables honored:**
- Multi-tenant isolation is mechanical (RLS + org_id on every table)
- All 5 modules behind feature flags, default OFF
- Facade-and-adapter for all business logic
- ENGINEERING_REVIEW_REQUIRED on every code-profile default
- QC records are append-only (immutable ledger)
- No invented code rules — parameters are tenant-configurable placeholders

---

## PRE-CONDITIONS (must complete before any Tier 1 module)

These are not features — they are structural fixes that every Tier 1 module depends on.

### PC-1: Standardize RLS Helper Names

**Problem (PHASE_0 Risk 6):** `schema.sql` defines `get_my_org_id()` but `011_mtrs.sql` and `013_flanges.sql` call `my_org_id()`. Fresh DB setup fails for MTR and flange tables.

**Fix:** New migration `20260710_rls_helpers.sql`:
```sql
-- Canonical aliases so both naming conventions resolve
CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.get_my_org_id();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT get_my_role() = 'platform_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT get_my_role() IN ('admin', 'platform_admin');
$$;
```

All new migrations use `get_my_org_id()` (canonical). These aliases let the existing migrations continue working.

### PC-2: Weld → Welder FK

**Problem (PHASE_0 Risk 1):** `welds.welder_stamp` is freetext. Qualification checks are string-match only.

**Fix migration:**
```sql
-- Add welder_id FK; keep welder_stamp for backward compat
ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS welder_id UUID REFERENCES public.welders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_welds_welder ON public.welds(welder_id);

-- Backfill: match stamp → welders table
UPDATE public.welds w
SET welder_id = wl.id
FROM public.welders wl
WHERE wl.organization_id = w.organization_id
  AND wl.stamp = w.welder_stamp
  AND w.welder_id IS NULL;
```

`welder_stamp` is NOT dropped — it stays as a human-readable display field. The FK is additive.

### PC-3: Heat Number on Welds

**Problem (PHASE_0 Risk 3):** No `heat_number` on welds. Batch-recall is impossible.

**Fix migration:**
```sql
ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS base_metal_heat_a TEXT,  -- primary base metal heat
  ADD COLUMN IF NOT EXISTS base_metal_heat_b TEXT,  -- second base metal (butt weld)
  ADD COLUMN IF NOT EXISTS filler_batch_number TEXT; -- filler wire lot/batch

CREATE INDEX IF NOT EXISTS idx_welds_heat_a  ON public.welds(base_metal_heat_a);
CREATE INDEX IF NOT EXISTS idx_welds_heat_b  ON public.welds(base_metal_heat_b);
CREATE INDEX IF NOT EXISTS idx_welds_filler  ON public.welds(filler_batch_number);
```

Three separate columns (not one) because a weld joints two base metals and a filler — each traceable independently.

### PC-4: Immutable Weld Event Log

**Problem:** `welds.status` is mutable. There is no append-only record of who changed what and when.

**New table:**
```sql
CREATE TABLE public.weld_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id         UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,  -- 'created','status_changed','qual_checked','qual_flagged',
                                  --   'qual_blocked','qual_overridden','nde_selected',
                                  --   'nde_result','heat_assigned','continuity_checked',
                                  --   'continuity_flagged','repair_linked'
  from_status     TEXT,           -- previous status (for status_changed events)
  to_status       TEXT,           -- new status
  actor_id        UUID NOT NULL REFERENCES public.user_profiles(id),
  actor_role      TEXT NOT NULL,
  reason          TEXT,           -- mandatory for overrides
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutability: no UPDATE or DELETE policies
ALTER TABLE public.weld_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weld_events_insert" ON public.weld_events
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "weld_events_read" ON public.weld_events
  FOR SELECT USING (organization_id = get_my_org_id());

-- Indexes
CREATE INDEX idx_weld_events_weld ON public.weld_events(weld_id, created_at DESC);
CREATE INDEX idx_weld_events_org  ON public.weld_events(organization_id, created_at DESC);
```

No UPDATE policy. No DELETE policy. This is the ledger.

---

## MODULE 1: WELDER QUALIFICATION + CONTINUITY ENFORCEMENT

**Feature flag:** `QUAL_ENFORCEMENT` (default OFF)  
**Tenant modes:** `HARD_BLOCK` or `FLAG` (configurable per org, stored in `org_settings`)

### 1.1 Data Model

**New table: `continuity_groups`**
```sql
CREATE TABLE public.continuity_groups (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  -- ENGINEERING_REVIEW_REQUIRED: window_hours is a placeholder default.
  -- Verify against your governing code (ASME B31.3 cl.328.2, B31.1, API 1104 S6)
  -- and client specification before activating QUAL_ENFORCEMENT.
  window_hours       NUMERIC NOT NULL DEFAULT 6,  -- ← ENGINEERING_REVIEW_REQUIRED
  created_by         UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**New table: `continuity_items`**
```sql
CREATE TABLE public.continuity_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id           UUID NOT NULL REFERENCES public.continuity_groups(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id            UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_items_group ON public.continuity_items(group_id);
CREATE INDEX idx_continuity_items_weld  ON public.continuity_items(weld_id);
```

**New table: `org_settings`** (if not already present)
```sql
CREATE TABLE public.org_settings (
  organization_id    UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  qual_enforcement_mode TEXT NOT NULL DEFAULT 'FLAG'
    CHECK (qual_enforcement_mode IN ('HARD_BLOCK', 'FLAG', 'OFF')),
  nde_engine_mode    TEXT NOT NULL DEFAULT 'OFF',
  updated_by         UUID REFERENCES public.user_profiles(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 Qualification Check Logic (Facade)

**Location:** `src/intelligence/engines/qualification-engine.ts`

This is NOT an AI adapter. It is a pure deterministic rules engine.

```typescript
interface QualificationCheckInput {
  weldId:         string
  welderId:       string
  wpsId:          string
  weldProcess:    string
  weldPosition:   string
  thicknessIn:    number
  organizationId: string
}

interface QualificationResult {
  qualified:      boolean
  reason:         string
  certUsed:       string | null  // cert ID if qualified
  continuityOk:   boolean
  continuityReason: string
  // ⚠️ ENGINEERING_REVIEW_REQUIRED: all range comparisons use tenant-
  // configured WPS ranges. This engine does not interpret code text.
  // Ranges come from wps_records.thickness_min_in / thickness_max_in
  // / cert_processes / cert_positions as entered by the tenant.
}
```

**Check sequence (in order):**

1. **Active cert exists?** Query `welder_certifications` where `welder_id = input.welderId` AND `is_active = true` AND `expiry_date > now()` AND `cert_processes @> ARRAY[input.weldProcess]` AND `cert_positions @> ARRAY[input.weldPosition]`.

2. **WPS thickness range?** Query `wps_records` where `id = input.wpsId`. Check `input.thicknessIn BETWEEN thickness_min_in AND thickness_max_in`.

3. **Continuity current?** Find all `continuity_groups` for this project containing this weld. For each group: find the most recent weld in the group by this welder. If `now() - last_weld_date > group.window_hours`, continuity is broken.

4. **Write to `weld_events`** (append-only) regardless of pass/fail.

5. **Return result.** The route handler applies the org's enforcement mode.

### 1.3 Enforcement Point

**Location:** `src/app/api/welds/route.ts` (POST handler) — modification

```typescript
// After weld data validation, before DB insert:
if (isFlagEnabled('QUAL_ENFORCEMENT')) {
  const qualResult = await qualificationEngine.check(qualInput)

  if (!qualResult.qualified || !qualResult.continuityOk) {
    const mode = await getOrgEnforcementMode(caller.organization_id)

    if (mode === 'HARD_BLOCK') {
      // Write blocked event to weld_events (weld NOT created)
      await writeWeldEvent({ eventType: 'qual_blocked', reason: qualResult.reason, ... })
      return NextResponse.json({ error: qualResult.reason, blocked: true }, { status: 422 })
    }

    if (mode === 'FLAG') {
      // Weld IS created, but flagged permanently
      weldInsertData.qualification_flag = qualResult.reason
      await writeWeldEvent({ eventType: 'qual_flagged', reason: qualResult.reason, ... })
      await notifySupervisors(caller.organization_id, ...)
    }
  }
}
```

### 1.4 Override Path

**Who:** Users with role `admin` or `project_manager` only.

**How:** `PATCH /api/welds/[id]/override-qualification` with body `{ reason: string }`.

```typescript
// The route:
// 1. Validates actor has admin/project_manager role
// 2. Validates reason is non-empty (mandatory)
// 3. Appends to weld_events: { event_type: 'qual_overridden', reason, actor_id, actor_role }
// 4. Updates welds.qualification_flag = null (cleared, but event log is permanent)
// Cannot delete the event_type: 'qual_flagged' row — it remains
```

### 1.5 UI Touch Points

- Weld form: show welder qualification status badge (green/red/amber) when welder is selected
- Weld form: show continuity status inline
- Weld list: qualification_flag column with filter
- Admin settings: toggle HARD_BLOCK / FLAG / OFF per org + configure continuity window
- All `window_hours` defaults render with: `⚠️ Verify against your governing code and client specification before activating enforcement.`

---

## MODULE 2: NDE ENGINE (BEHIND THE FACADE)

**Feature flag:** `NDE_ENGINE` (default OFF)

### 2.1 Data Model

**New table: `nde_code_profiles`** (reference, tenant-configurable)
```sql
CREATE TABLE public.nde_code_profiles (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_name       TEXT NOT NULL,  -- e.g. 'ASME B31.3 Normal Fluid', 'API 1104'
  -- ⚠️ ENGINEERING_REVIEW_REQUIRED: sampling_pct_normal, progressive rules,
  -- acceptance criteria are tenant-entered parameters. This system does
  -- NOT interpret or validate code text. Verify all parameters against
  -- the governing code edition and your client specification.
  sampling_pct_rt    NUMERIC NOT NULL DEFAULT 5,    -- ← ENGINEERING_REVIEW_REQUIRED
  sampling_pct_ut    NUMERIC NOT NULL DEFAULT 0,    -- ← ENGINEERING_REVIEW_REQUIRED
  sampling_pct_pt    NUMERIC NOT NULL DEFAULT 0,    -- ← ENGINEERING_REVIEW_REQUIRED
  progressive_trigger_count INT NOT NULL DEFAULT 1, -- ← ENGINEERING_REVIEW_REQUIRED
  progressive_add_pct NUMERIC NOT NULL DEFAULT 10,  -- ← ENGINEERING_REVIEW_REQUIRED
  acceptance_standard TEXT NOT NULL DEFAULT 'TENANT_DEFINED', -- ← ENGINEERING_REVIEW_REQUIRED
  notes              TEXT,
  created_by         UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**New table: `nde_plans`**
```sql
CREATE TABLE public.nde_plans (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code_profile_id    UUID NOT NULL REFERENCES public.nde_code_profiles(id),
  plan_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','closed')),
  created_by         UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**New table: `nde_selections`** (the deterministic audit trail)
```sql
CREATE TABLE public.nde_selections (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nde_plan_id        UUID NOT NULL REFERENCES public.nde_plans(id) ON DELETE CASCADE,
  weld_id            UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  inspection_type    TEXT NOT NULL,  -- RT / UT / PT / MT / VT
  selection_seed     TEXT NOT NULL,  -- stored seed used to generate this selection
  selection_rank     INTEGER NOT NULL, -- rank in the seeded sort (for audit: re-run seed → same ranks)
  selection_reason   TEXT NOT NULL,  -- 'random_sample' | 'progressive_penalty' | 'mandatory'
  selected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  selected_by_engine BOOLEAN NOT NULL DEFAULT true  -- false if manually added
);

CREATE UNIQUE INDEX idx_nde_sel_weld_type ON public.nde_selections(weld_id, inspection_type);
CREATE INDEX idx_nde_sel_plan ON public.nde_selections(nde_plan_id);
```

### 2.2 Deterministic Selection Algorithm

**Location:** `src/intelligence/engines/nde-selection-engine.ts`

```typescript
interface NdeSelectionInput {
  planId:         string
  organizationId: string
  weldIds:        string[]  // population to select from
  inspectionType: 'RT' | 'UT' | 'PT' | 'MT' | 'VT'
  samplingPct:    number    // from code_profile — tenant-configured
  seed:           string    // stored; format: `${planId}-${inspectionType}-${iso_date}`
}

// Algorithm:
// 1. Hash each weld_id + seed using SHA-256 → numeric score
// 2. Sort weld_ids by score (deterministic — same seed always produces same order)
// 3. Select top N = Math.ceil(weldIds.length * samplingPct / 100)
// 4. Insert into nde_selections with selection_rank = position in sorted list
// 5. Store seed on each row
//
// Audit verification: give auditor the seed → they re-run the same sort → 
// identical selection_rank values confirm no cherry-picking
```

### 2.3 Progressive Penalty Logic

When a welder fails NDE:
1. Count failures for that welder in current plan period
2. If failures >= `code_profile.progressive_trigger_count`:
   - Re-run selection for that welder's remaining unwelded joints
   - Additional `progressive_add_pct` added to their personal sampling rate
   - Reason: `'progressive_penalty'`
   - Append to `weld_events` on affected welds

### 2.4 Repair Loop Data Flow

```
weld (status: welded)
  → nde_selections row (selected_at)
  → nde_inspections row (result: fail)
  → weld_events: nde_result fail
  → new weld created (repair) with repair_weld_id = original weld_id
  → new nde_selections row auto-created for repair weld
  → repair rate = COUNT(repair welds) / COUNT(all welds by welder in period)
```

Repair rate is a **computed value**, never a stored field. Computed from `weld_events` ledger.

### 2.5 UI Touch Points

- NDE Tracker page: redesigned to show plan → selections → inspections (not just ad-hoc inspections)
- Selection status badge per weld: Not Required / Pending Selection / Selected / Inspected / Cleared
- Code profile settings page (admin only) — with `⚠️ ENGINEERING_REVIEW_REQUIRED` banner on every parameter
- Progressive penalty alert in welder performance view

---

## MODULE 3: MATERIAL TRACEABILITY

**Feature flag:** `MATERIAL_TRACE` (default OFF)

### 3.1 Data Model

**Extend `welds` table (PC-3 already covers this):**
- `base_metal_heat_a TEXT` — primary base metal
- `base_metal_heat_b TEXT` — second base metal (for butt welds)
- `filler_batch_number TEXT` — filler wire lot/batch

**New table: `mtr_documents`** (file attachments)
```sql
CREATE TABLE public.mtr_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mtr_id          UUID NOT NULL REFERENCES public.mtrs(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  document_type   TEXT NOT NULL DEFAULT 'mtr_certificate'
                  CHECK (document_type IN ('mtr_certificate','test_report','coc','other')),
  uploaded_by     UUID REFERENCES public.user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Batch-Recall Query (First-Class Feature)

**Endpoint:** `GET /api/material-trace?heat_number=A1234B`

This is a single SQL query path (not multiple round trips):

```sql
SELECT
  w.id            AS weld_id,
  w.weld_id_number,
  w.organization_id,
  w.project_id,
  p.name          AS project_name,
  s.spool_number,
  w.status        AS weld_status,
  'base_metal_a'  AS heat_role
FROM public.welds w
JOIN public.projects p ON p.id = w.project_id
LEFT JOIN public.spools s ON s.id = w.spool_id
WHERE w.organization_id = get_my_org_id()
  AND w.base_metal_heat_a = $1

UNION ALL

SELECT w.id, w.weld_id_number, w.organization_id, w.project_id,
       p.name, s.spool_number, w.status, 'base_metal_b'
FROM public.welds w
JOIN public.projects p ON p.id = w.project_id
LEFT JOIN public.spools s ON s.id = w.spool_id
WHERE w.organization_id = get_my_org_id()
  AND w.base_metal_heat_b = $1

UNION ALL

SELECT w.id, w.weld_id_number, w.organization_id, w.project_id,
       p.name, s.spool_number, w.status, 'filler_batch'
FROM public.welds w
JOIN public.projects p ON p.id = w.project_id
LEFT JOIN public.spools s ON s.id = w.spool_id
WHERE w.organization_id = get_my_org_id()
  AND w.filler_batch_number = $1
ORDER BY project_name, spool_number;
```

Response includes: list of affected welds grouped by project + spool, total count, distinct systems, MTR status (accepted/rejected/quarantine).

**If MTR status is 'rejected' or 'quarantine': response includes `severity: 'critical'` and triggers a system_alert insert.**

### 3.3 UI Touch Points

- MTR record page: "Find all welds using this heat" button → batch-recall results
- Weld form: heat number fields (A, B, filler) with autocomplete from `mtrs.heat_number` in org
- MTR list: rejected/quarantine badge with weld count affected
- Material Trace search page (admin): global heat number / batch search

---

## MODULE 4: TURNOVER PACKAGE GENERATOR

**Feature flag:** `TURNOVER_GEN` (default OFF)

### 4.1 Data Model

**New table: `turnover_packages`**
```sql
CREATE TABLE public.turnover_packages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_name      TEXT NOT NULL,  -- e.g. "System 101 — Hydrocarbon Feed"
  system_scope      TEXT,           -- description of what's included
  status            TEXT NOT NULL DEFAULT 'building'
                    CHECK (status IN ('building','gap_check','gap_report_ready','generating','complete','failed')),
  -- Completeness check results (written before generation)
  gap_report        JSONB,          -- { missing_nde: [...], missing_quals: [...], ... }
  gap_check_at      TIMESTAMPTZ,
  -- Generated book (immutable after creation)
  storage_path      TEXT,           -- Supabase storage path (immutable)
  content_hash      TEXT,           -- SHA-256 of all included documents at generation time
  generated_at      TIMESTAMPTZ,
  generated_by      UUID REFERENCES public.user_profiles(id),
  -- Job tracking
  job_started_at    TIMESTAMPTZ,
  job_completed_at  TIMESTAMPTZ,
  job_error         TEXT,
  created_by        UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable after status = 'complete': no UPDATE on storage_path, content_hash, generated_at
-- Enforced at application layer (route handler validates current status before allowing updates)
```

### 4.2 Package Contents (per Tier 1 spec)

1. **Weld log** — all welds in scope with status, welder, date, WPS, heat numbers
2. **NDE reports** — all nde_inspections for welds in scope (linked via weld_id)
3. **Welder qualifications** — welder_certifications records for all welders who worked on scope welds
4. **WPS list** — all wps_records used in scope
5. **MTR index** — all heat numbers used + their mtr_certificate documents
6. **Hydrotest records** — pressure test records (existing table)
7. **ITP completion** — ITP items for scope

### 4.3 Completeness Check (Gap Report — runs BEFORE generation)

**Endpoint:** `POST /api/turnover-packages/[id]/gap-check`

Checks (in order):

```typescript
interface GapReport {
  // Welds with no NDE result when NDE was required
  missing_nde: Array<{ weld_id: string; weld_number: string; required_type: string }>
  // Welds with qualification flags not overridden
  qual_flags: Array<{ weld_id: string; weld_number: string; flag: string }>
  // Heat numbers without MTR documents attached
  missing_mtr_docs: Array<{ heat_number: string; material_spec: string }>
  // Welders in scope without active certification at time of welding
  cert_gaps: Array<{ welder_id: string; welder_name: string; weld_dates: string[] }>
  // Pressure tests not yet recorded
  missing_pressure_tests: Array<{ spool_id: string; spool_number: string }>
  // Overall
  total_gaps: number
  can_generate: boolean  // true only if total_gaps === 0
}
```

Gap report is written to `turnover_packages.gap_report` and stored. Generation is blocked unless `can_generate === true`.

### 4.4 Generation Job

**Execution model:** Vercel serverless with 60-second limit (Pro plan). For packages exceeding this, the job is split:

1. `POST /api/turnover-packages/[id]/generate` — starts job, writes `job_started_at`, returns 202
2. Job writes PDFs in chunks to Supabase storage, updates `status` column as it progresses
3. Client polls `GET /api/turnover-packages/[id]` for status
4. On completion: write `storage_path`, `content_hash` (SHA-256), `generated_at`

**Content hash:** Computed as `SHA-256(sorted concatenation of all source record IDs + their updated_at timestamps)`. If any source record changes after generation, re-generation is required (detected by re-computing hash).

**Immutability:** Once `status = 'complete'`, the route handler refuses any update to `storage_path`, `content_hash`, or `generated_at`. A new package must be generated. Old packages are never deleted.

### 4.5 UI Touch Points

- Turnover Packages list page per project
- New package wizard: select scope (spools / system tags) → run gap check → view gap report → generate
- Gap report UI: expandable sections per gap type, direct links to resolve each gap
- Package view: download PDF book, view content hash, generation timestamp

---

## MODULE 5: OFFLINE FIELD ENTRY + EXCEL I/O

**Feature flag:** `OFFLINE_FIELD` (default OFF)

### 5.1 Offline Honest Scope Decision

**Phase 0 finding:** No offline write capability exists. PWA caches reads only. No IndexedDB, no SQLite.

**Architecture decision: Append-only IndexedDB queue (Option A)**

Rationale: Weld log entries are naturally append-only. A welder in the field is creating NEW weld records, not editing existing ones. This means sync conflicts are **ordering problems** (which record gets inserted first), not **overwrite problems** (two edits to the same record). IndexedDB queue + timestamp ordering resolves all cases without conflict resolution logic.

**NOT in scope for Tier 1.0:**
- Offline editing of existing welds
- Offline NDE inspection entry
- Offline read of full weld history (too large to cache safely)

**IN scope for Tier 1.0:**
- Offline creation of new weld records (core field entry)
- Read-only cached view of today's welds (last-sync cached)
- Sync-on-reconnect with deduplication

### 5.2 IndexedDB Schema

**Store: `weld_queue`**
```typescript
interface QueuedWeldEntry {
  localId:        string        // UUID generated client-side
  organizationId: string
  projectId:      string
  weldIdNumber:   string
  welderStamp:    string
  weldDate:       string        // ISO date
  wpsId?:         string
  notes?:         string
  baseMetalHeatA?: string
  fillerBatch?:   string
  queuedAt:       string        // ISO timestamp — used for ordering
  syncStatus:     'pending' | 'synced' | 'failed'
  syncError?:     string
  serverWeldId?:  string        // filled after successful sync
}
```

**Sync endpoint:** `POST /api/welds/sync-queue`
```typescript
// Accepts array of queued entries
// For each: attempt insert; if duplicate weld_id_number in project → mark as duplicate
// Returns: { synced: string[], failed: Array<{localId, reason}>, duplicates: string[] }
// Idempotent: re-posting a synced entry (same localId) returns 'already_synced' without error
```

### 5.3 Sync Trigger

```typescript
// src/lib/offline/sync.ts
// Called on:
// 1. window 'online' event
// 2. App foreground (visibilitychange)
// 3. Manual "Sync now" button
// 4. PWA background sync (if supported)
```

### 5.4 Excel Import

**New dependency:** `exceljs` (server-side; zero client-side bundle impact)

**Templates (3 formats):**

**A. Weld Log Import Template**
| Column | Required | Notes |
|--------|----------|-------|
| Weld ID | ✅ | Unique per project |
| Project Number | ✅ | Must match existing project |
| Spool Number | — | Must match if provided |
| Welder Stamp | — | |
| Weld Date | — | ISO date or DD/MM/YYYY |
| WPS Number | — | Must match if provided |
| Heat A | — | Must exist in MTRs if MATERIAL_TRACE ON |
| Filler Batch | — | Must exist in MTRs if MATERIAL_TRACE ON |
| Notes | — | |

**B. Welder Roster Import**
Columns: Full Name, Stamp/Badge, Cert Type, Cert Number, Processes (comma-sep), Positions (comma-sep), Issue Date, Expiry Date

**C. MTR Index Import**
Columns: Heat Number, MTR Number, Material Spec, Material Type, Nominal Size, Schedule, Quantity, Unit, Supplier, Received Date

**Dry-Run Validation (mandatory — runs before commit):**
```typescript
interface ImportValidationReport {
  totalRows: number
  validRows: number
  errors: Array<{
    row:     number
    column:  string
    value:   string
    error:   string  // human-readable: "Project 'P-001' not found in this organization"
  }>
  warnings: Array<{ row: number; column: string; message: string }>
  canCommit: boolean  // true only if errors.length === 0
}
```

**Endpoint flow:**
1. `POST /api/import/[type]/dry-run` — validate, return report, NO DB writes
2. User reviews report
3. `POST /api/import/[type]/commit` with same file — re-validates + inserts if still clean
4. On commit error: full rollback (transaction)

### 5.5 Excel Export

**Endpoint:** `GET /api/export/weld-log?project_id=X&format=xlsx`

Mirrors the import template format exactly so exported files can be edited and re-imported.

**Columns exported:** All import columns + current status + NDE result (latest) + qualification flag status.

---

## BUILD ORDER (Phase 2)

Strict sequencing — each module depends on prior ones:

```
Week 1:  PC-1 (RLS helpers) → PC-2 (welder FK) → PC-3 (heat numbers) → PC-4 (weld events)
Week 2:  Module 3 (Material Trace) — feeds MTR data into later modules
Week 3:  Module 1 (Qual Enforcement) — depends on PC-2 + weld_events
Week 4:  Module 2 (NDE Engine) — depends on weld_events + Module 3
Week 5:  Module 5 part A (Excel I/O) — independent, parallels Module 4
Week 6:  Module 4 (Turnover Generator) — consumes all others
Week 7:  Module 5 part B (Offline Queue) — last; touches weld creation path
```

---

## NEW DEPENDENCIES TO ADD

| Package | Use | Why not already present |
|---------|-----|------------------------|
| `exceljs` | Excel import/export | Only PDF exists today |
| `idb` | IndexedDB wrapper (offline queue) | No offline writes today |
| `csv-stringify` | CSV export (lighter than exceljs for flat tables) | No CSV export today |

No Prisma. No new database drivers. Supabase client already present.

---

## ENGINEERING_REVIEW_REQUIRED INVENTORY

Every parameter below renders a disclaimer in UI and carries the comment in code:

| Parameter | Default | Module | Location |
|-----------|---------|--------|----------|
| continuity_groups.window_hours | 6 hours | Qual Enforcement | org_settings UI |
| nde_code_profiles.sampling_pct_rt | 5% | NDE Engine | code profile settings |
| nde_code_profiles.sampling_pct_ut | 0% | NDE Engine | code profile settings |
| nde_code_profiles.progressive_trigger_count | 1 failure | NDE Engine | code profile settings |
| nde_code_profiles.progressive_add_pct | 10% | NDE Engine | code profile settings |
| nde_code_profiles.acceptance_standard | TENANT_DEFINED | NDE Engine | code profile settings |

UI disclaimer (shown on every settings page containing these fields):

> ⚠️ **Engineering Review Required**  
> These parameters are tenant-configurable placeholders. PipeField OS does not interpret or validate welding codes. Verify all values against your governing code edition (ASME B31.3, B31.1, API 1104, or other applicable standard) and your client or EPC specification before activating enforcement. Incorrect parameters may cause non-conforming welds to pass or conforming welds to be blocked.

---

PHASE 1 COMPLETE — AWAITING: APPROVED: PHASE 1
