# PHASE_0_FINDINGS.md
## PipeField OS — Architectural Reconnaissance for Tier 1 + Tier 2 Build

**Audit Date:** 2026-07-10  
**Scope:** Read-only analysis. Zero writes.  
**Rule:** Every claim cited to file:line. Unmarked claims are direct code observations.

---

## 1. DOMAIN MODEL TODAY

### 1.1 Welds Table
**Source:** `supabase/schema.sql:102–121`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations(id) |
| project_id | uuid | FK → projects(id) REQUIRED |
| spool_id | uuid | FK → spools(id) ON DELETE SET NULL |
| weld_id_number | text | Human ID e.g. "W-0001" |
| welder_stamp | text | **FREETEXT — no FK to welders** |
| welder_name | text | Denormalized — not auto-sync'd |
| wps_id | uuid | FK → wps_records(id) (added in 20260702_wps.sql:26) |
| status | text | CHECK enum: draft / fit_up_approved / welded / visual_pass / xray_pending / failed / repaired / accepted |
| weld_date | date | |
| notes | text | |
| created_by, created_at, updated_at | | |

**TIER 1 GAPS:**
- No `heat_number` column — MTR heat numbers cannot be bound to individual welds
- `welder_stamp` is freetext — no FK to welder_certifications; qualification validation is fragile
- No `welder_id` FK — continuity enforcement has no reliable link to the welders table

**Indexes:** `idx_welds_org`, `idx_welds_project`, `idx_welds_spool` (single); composite `idx_welds_org_created`, `idx_welds_project_created` — `supabase/migrations/20260704_composite_indexes.sql:17–21`

**RLS:** `supabase/schema.sql:239–241` — `organization_id = get_my_org_id()` (ALL operations)

---

### 1.2 Spools Table
**Source:** `supabase/schema.sql:76–96`

| Column | Type | Notes |
|--------|------|-------|
| id, organization_id, project_id | uuid | Tenant-scoped |
| spool_number | text | Unique per project |
| drawing_number, area, line_number | text | Optional P&ID refs |
| assigned_crew | text | Free-form; no FK to crews |
| status | text | enum: in_design / released_for_fab / in_fab_shop / quality_review / shipped / in_transit / on_site_layout / installed / complete |

**RLS:** `supabase/schema.sql:236–237` — org isolation only

---

### 1.3 Welders Table
Schema inferred from migration references. The base table is assumed to exist in the live DB (not fully present in schema.sql). The `supabase/migrations/20260702_welder_certs.sql` adds cert columns to it.

---

### 1.4 Welder Certifications Table
**Source:** `supabase/migrations/20260702_welder_certs.sql:10–35`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| welder_id | uuid | FK → welders(id) |
| organization_id | uuid | Tenant scoping (denormalized) |
| cert_type | text | e.g. 'CWB', 'AWS D1.1', 'ASME IX' |
| cert_number | text | |
| cert_processes | text[] | ARRAY['SMAW','GTAW'] |
| cert_positions | text[] | ARRAY['1G','2G','6G'] |
| issued_date, expiry_date | date | |
| is_active | boolean | |

**Indexes:** on welder_id, expiry_date, organization_id — `20260702_welder_certs.sql:26–28`  
**RLS:** org members can manage — `20260702_welder_certs.sql:30–35`

---

### 1.5 WPS Table
**Source:** `supabase/migrations/20260702_wps.sql:1–27`

| Column | Type | Notes |
|--------|------|-------|
| id, organization_id | uuid | |
| wps_number, revision | text | Unique per org+revision |
| process | text | e.g. 'SMAW', 'GTAW' |
| base_metal_p_numbers | text | e.g. "P1, P3" |
| filler_material | text | |
| thickness_min_in, thickness_max_in | numeric | Range |
| position | text | e.g. "1G", "6G" |
| pwht_required | boolean | |
| is_active | boolean | |

**`welds.wps_id`** FK added at `20260702_wps.sql:26` ✓

---

### 1.6 NDE Inspections Table
**Source:** `supabase/005_nde_photos.sql:8–48`

| Column | Type | Notes |
|--------|------|-------|
| id, organization_id, project_id | uuid | |
| weld_id | uuid | FK → welds(id) ON DELETE CASCADE |
| inspection_type | text | CHECK: RT / UT / PT / MT / VT / PMI / HT |
| result | text | pending / pass / fail / repair / retest |
| inspector_name, inspection_date | text, date | |
| report_number, acceptance_code | text | |
| defect_type, defect_location | text | |
| repair_weld_id | uuid | FK → welds(id) ON DELETE SET NULL |

**TIER 1 GAPS:**
- No NDE **plan/selection** table — inspections are ad-hoc, not tied to an upfront plan
- No acceptance standard reference (ASME B31.3 code values not encoded anywhere)
- Deterministic selection with stored seed: NOT PRESENT

---

### 1.7 MTR / Material Table
**Source:** `supabase/011_mtrs.sql:1–61`

Fully featured table with:
- `heat_number`, `mtr_number`, `material_spec`, `material_type`
- Chemical composition columns (carbon_pct, manganese_pct, etc.)
- Mechanical properties (yield_strength, tensile_strength, etc.)
- `status`: received / accepted / rejected / quarantine / consumed

**TIER 1 GAP:** `heat_number` in `mtrs` is NOT FK'd to `welds` — batch-recall query cannot be run today.

**RLS uses `my_org_id()`** — inconsistent with `get_my_org_id()` elsewhere (see Risk 8.10)

---

### 1.8 Flange Joints Table
**Source:** `supabase/013_flanges.sql:1–57`

Complete table including: joint_number, line_number, spool_id FK, flange_type, flange_rating, gasket_type/material, bolt_spec/size/count/nut_spec, target_torque_nm, assembled_by/date, torque_wrench_id, final_torque_nm, status (pending/assembled/torqued/inspected/leak_tested/accepted/rejected).

**STATUS:** Flange table exists and is well-designed. Tier 2 Flange Management module (`FLANGE_MGMT`) has a solid foundation to build on.

**RLS uses `my_org_id()` and `is_org_admin()`** — inconsistent naming (see Risk 8.10)

---

## 2. TENANT ISOLATION MECHANISM

### 2.1 RLS Helper Functions
**Source:** `supabase/schema.sql:189–212`

```sql
-- PRIMARY (used in schema.sql, intelligence migrations)
create or replace function public.get_my_org_id() returns uuid ...
create or replace function public.get_my_role() returns text ...
```

**⚠️ INCONSISTENCY:** `supabase/011_mtrs.sql` and `supabase/013_flanges.sql` call `my_org_id()` and `is_platform_admin()` — these are NOT defined in schema.sql. Either they exist in an unread migration or **fresh DB setup will fail on these tables.**

### 2.2 RLS Policy Summary

| Table | Policy Pattern | Source |
|-------|---------------|--------|
| organizations | id = get_my_org_id() | schema.sql:215–216 |
| user_profiles | organization_id = get_my_org_id() | schema.sql:219–228 |
| projects | organization_id = get_my_org_id() (ALL) | schema.sql:232–233 |
| spools | organization_id = get_my_org_id() (ALL) | schema.sql:236–237 |
| welds | organization_id = get_my_org_id() (ALL) | schema.sql:240–241 |
| welder_certifications | org members manage | 20260702_welder_certs.sql:30–35 |
| wps_records | org members manage | 20260704_rls_missing_tables.sql:26–31 |
| nde_inspections | my_org_id() | 005_nde_photos.sql:41–48 |
| mtrs | my_org_id() | 011_mtrs.sql:53–60 |
| flange_joints | my_org_id() | 013_flanges.sql:50–57 |
| ai_invocations | get_my_org_id() | 20260708_intelligence_engine.sql:59–68 |

### 2.3 Application-Layer Isolation
**Source:** `src/app/api/welds/import/route.ts:45–53`

Pattern: `requireAuth()` → extract `caller.organization_id` → scope all queries with `.eq('organization_id', caller.organization_id)`. Used consistently across API routes. Supabase RLS is the backstop.

---

## 3. INTELLIGENCE ENGINE FACADE

### 3.1 Public Surface
**Source:** `src/intelligence/index.ts`, `src/intelligence/registry.ts`

- **`invoke<TIn, TOut>(capability, ctx, input)`** — Main entry point
- **`describe(capability)`** — Descriptor without invocation
- **`listCapabilities()`** — All registered capabilities + status

### 3.2 Invocation Context
```typescript
interface InvocationContext {
  organizationId: string
  userId:         string   // user_profiles.id
  authUserId:     string   // auth.uid()
  capability:     CapabilityName
  flagState:      Record<string, boolean>
}
```

### 3.3 Gateway Sequence (registry.ts:74–215)
1. Master flag gate (`PFOS_INTELLIGENCE_ENGINE_ENABLED`)
2. Resolve adapter from REGISTRY Map
3. NOT_IMPLEMENTED check
4. `capability_overrides` table check (self-healing — **table not yet migrated, see Risk 8.9**)
5. Tier gating (requiredTiers on descriptor)
6. Daily token budget (if `PFOS_INTELLIGENCE_COST_CONTROLS` flag on)
7. Adapter invocation
8. Audit log write to `ai_invocations`

### 3.4 All 13 Active Capabilities
`src/intelligence/registry.ts:43–59`: rag-qa, document-embedding, welding-guidance, safety-analysis, qa-qc-assistance, pipefitter-assistant, material-takeoff, inspection, fabrication-planning, estimating, scheduling, drawing-analysis, digital-twin.

### 3.5 Tier 1 Integration Point
New engines (NDE plan builder, continuity validator, qualification checker) should register as adapters in REGISTRY and be invoked via `invoke()`. Context carries `organizationId` — all adapters already scope queries by it.

---

## 4. MOBILE / FIELD ENTRY TODAY

### 4.1 PWA Config
**Source:** `next.config.mjs:111–150` — `@ducanh2912/next-pwa@10.2.9`

- Production-only PWA enabled
- Runtime caching: Supabase API (Network First, 24h)
- Offline fallback: `/offline.html`
- Static assets: CacheFirst, 30-day TTL

### 4.2 Manifest
**Source:** `public/manifest.json` — Standalone display, shortcuts to `/welds/new` and `/dashboard`

### 4.3 Capacitor (Native Mobile)
`package.json`: `@capacitor/ios@8.4.1`, `@capacitor/android@8.4.1`, barcode scanning, push notifications.

### 4.4 Offline Scope (HONEST ASSESSMENT)
**Source:** `src/hooks/useOfflineCalc.ts:1–161`

**Only the pipe span calculator has offline support** — tries server first (8s timeout), falls back to pure-TS client-side calc in `src/lib/offline/pipeCalc.ts`.

**NO offline write queue.** No IndexedDB, no SQLite, no local database for transactional queuing. Field weld entry requires network.

**Tier 1 recommendation for offline weld entry:** Append-only event queue in IndexedDB (weld events are naturally conflict-free as ordered writes). This is a significant addition — should be scoped as a discrete sub-feature with its own flag (`OFFLINE_FIELD`).

---

## 5. FILE / REPORT GENERATION

**Library:** `@react-pdf/renderer@4.5.1` — `package.json:34`

| Route | Output |
|-------|--------|
| /api/reports/weld-log-pdf | Landscape A4 weld table (dark theme) |
| /api/reports/qa-package | Multi-page QA document (cover + NDE) |
| /api/reports/spool-release | Spool release certificate |
| /api/reports/pressure-test-certificate | Hydrotest record |
| /api/reports/itp-certificate | ITP certificate |
| /api/reports/executive-report | Executive summary |

**No Excel export library found.** CSV/XLSX output is not currently supported.

**Status mismatch risk:** `weld-log-pdf` route uses status labels ('pending','in_progress','accepted') that do NOT match the `welds.status` enum in schema.sql ('draft','fit_up_approved','welded','visual_pass','xray_pending','failed','repaired','accepted'). Verified at `src/app/api/reports/weld-log-pdf/route.ts`.

---

## 6. IMPORT SURFACE

**Source:** `src/app/api/welds/import/route.ts`

- Accepts JSON array of rows (max 500 per batch)
- Validates: org ownership of project IDs, duplicate detection, Zod schema per row
- Fields accepted: weld_id_number, project_id, welder_name, welder_stamp, weld_date, notes
- **No heat_number, welder_id, or WPS fields in import schema**
- No CSV/XLSX parser in backend — frontend is expected to transform CSV to JSON before POST

**No Excel import library found** (`package.json` audit).

---

## 7. ISO_VIEWER FEASIBILITY

### 7.1 Current Drawing Data
- **Weld Map** (`src/app/(dashboard)/weld-map/page.tsx`): SVG only. Positions calculated algorithmically from spool data, not from actual drawings. No real-world coordinates.
- **Drawing Analysis** (`src/app/(dashboard)/intelligence/drawing-analysis/page.tsx`): Accepts a public URL → passes to GPT-4o vision → returns JSON analysis. **Not stored server-side.** Output is ephemeral.
- **No drawing documents table.** No server-side drawing storage.
- **No 3D libraries** in package.json (no Three.js, Babylon.js, @react-three/fiber, IFC.js).

### 7.2 ISO_VIEWER Honest Scope

**Stage A (buildable now):**
Upload PDF/image isometrics, pin weld IDs to coordinates on the drawing, color by status. Works with what contractors already have (PDF isos). No 3D needed. Requires:
- New `drawing_documents` table (storage_path, project_id, drawing_type, metadata)
- New `weld_drawing_pins` table (weld_id, drawing_id, x_pct, y_pct)
- Frontend: PDF.js for rendering + click-to-pin UI

**Stage B (3D — contingent):**
Only possible if tenants supply IFC or glTF models. No path to generate 3D from 2D isos. Without customer-provided models, Stage B ships as a feature-flagged stub with a note.

**Recommendation:** Build Stage A in Tier 2. Stage B gated on first customer with IFC files.

---

## 8. RISKS

### Risk 1 — `welds.welder_stamp` is Freetext (CRITICAL)
`welds.welder_stamp` has no FK to `welders`. Qualification checks must string-match, which breaks if stamps change. **Tier 1 must add `welds.welder_id UUID → welders(id)` and backfill from stamp.**

### Risk 2 — No NDE Selection Plan (HIGH)
NDE inspections are ad-hoc. No upfront plan table specifying which welds require what inspection type. An auditor cannot verify completeness without it.

### Risk 3 — Heat Number Not Bound to Welds (HIGH)
`mtrs.heat_number` exists but is not referenced in `welds`. Batch-recall query is impossible today.

### Risk 4 — Continuity Events — No Schema (HIGH)
No table for continuity groups. Logic would be 100% application-side with no DB-level audit trail.

### Risk 5 — `capability_overrides` Table Not Migrated (MEDIUM)
`src/intelligence/registry.ts:109` queries this table; the query is wrapped in try-catch (line 120) so failure is silent. Self-healing auto-disable does NOT work until the migration from `supabase/migrations/20260708_system_monitoring.sql` is applied.

### Risk 6 — RLS Helper Naming Inconsistency (MEDIUM)
`schema.sql` defines `get_my_org_id()`. `011_mtrs.sql` and `013_flanges.sql` call `my_org_id()`. On a fresh database, MTR and flange RLS policies will fail to create. Must standardize before Tier 1 writes new migrations.

### Risk 7 — Weld Log PDF Status Label Mismatch (LOW-MEDIUM)
Report uses different status enum values than the database. PDF labels will be wrong for certain statuses until fixed.

### Risk 8 — No Offline Write Queue (MEDIUM)
Field entry requires network. `OFFLINE_FIELD` flag is defined but capability is not built. Any Tier 1 offline work starts from zero.

### Risk 9 — Missing Indexes for Tier 1 Queries (MEDIUM)
Queries needed: welds by welder_id+status, welds by heat_number, welds by welder_id+weld_date (range). None of these indexes exist. Will full-scan as data grows.

### Risk 10 — No Excel Library (LOW)
Tier 1 requires Excel import/export. `exceljs` or `xlsx` must be added. Currently PDF-only for all reports.

---

## 9. SCHEMA COMPLETENESS vs. TIER 1 REQUIREMENTS

| Requirement | Exists? | Action Required |
|-------------|---------|-----------------|
| Welds core schema | ✅ | Add heat_number + welder_id FK |
| Welder certifications (ranges) | ✅ | No change — link welds to it |
| WPS with thickness/process ranges | ✅ | No change |
| Continuity events | ❌ | New tables: continuity_groups, continuity_items |
| Heat number on welds | ❌ | Add welds.heat_number → mtrs |
| NDE upfront selection plan | ❌ | New tables: nde_plans, nde_plan_items |
| NDE acceptance standards | ❌ | Add nde_acceptance_criteria ref table |
| Immutable QC audit trail | ⚠️ Partial | welds.status can be updated; needs append-only events table |
| Turnover package generation | ⚠️ Partial | PDF exists; no assembly + completeness-check logic |
| Offline write queue | ❌ | New: IndexedDB queue + sync endpoint |
| Excel import/export | ❌ | New: exceljs dependency + routes |
| Flange management | ✅ Table exists | Tier 2 can build on it directly |
| QC analytics | ⚠️ Data exists | Computation layer needed, no materialized views |
| ISO viewer (Stage A) | ❌ | New: drawing_documents + weld_drawing_pins tables + PDF viewer UI |
| ISO viewer (Stage B / 3D) | ❌ | Stub only until customer provides IFC/glTF |

---

## 10. RECOMMENDED PHASE 1 PLAN PRIORITIES

Based purely on what exists:

1. **Standardize RLS helpers** (prerequisite — all new migrations depend on it)
2. **Add `welds.welder_id` FK** (prerequisite for qualification enforcement)
3. **Add `welds.heat_number`** (prerequisite for material trace)
4. **Add NDE plan tables** (prerequisite for NDE engine)
5. **Add continuity tables** (prerequisite for continuity enforcement)
6. **Add Excel library** (prerequisite for import/export)
7. **Immutable weld event log** (append-only ledger alongside existing status column)
8. **Turnover package assembler** (builds on existing PDF library)

---

PHASE 0 COMPLETE — AWAITING: APPROVED: PHASE 0
