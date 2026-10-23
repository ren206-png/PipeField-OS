# Phase 0 Findings — ISO Tap-to-Calculate

> Read-only analysis. No code changes. All citations are file:line.

---

## 1. Framework & Tooling

| Item | Value | Source |
|------|-------|--------|
| Next.js | 14.2.29 | `package.json:60` |
| React | 18.3.1 | `package.json:61` |
| TypeScript | 5.9.3 | `package.json:87` |
| Zod | 3.25.76 | `package.json:75` |
| Tailwind CSS | 3.4.19 | `package.json:88` |
| Unit test runner | Jest 30.4.2 (ts-jest 29.4.11) | `package.json:83`, `jest.config.ts` |
| E2E test runner | Playwright 1.61.1 | `package.json:80` |
| Package manager | npm (package-lock.json present) | repo root |
| Build command | `next build` | `package.json:7` |
| Test command | `jest` / `jest --coverage` | `package.json:19–21` |
| Bundle analyzer | `@next/bundle-analyzer` — enable with `ANALYZE=true npm run build` | `next.config.mjs:8–10` |
| Lint | `next lint` (eslint-config-next 14.2.3) | `package.json:8`, `package.json:84` |
| IndexedDB abstraction | `idb` 8.0.3 | `package.json:46` |

**Jest config** (`jest.config.ts`): preset `ts-jest`, testEnvironment `node`, `@/` alias mapped to `src/`, testMatch `**/__tests__/**/*.test.ts(x)`.

**tsconfig.json**: strict mode, `moduleResolution: "bundler"`, `@/` → `src/`.

---

## 2. Feature-Flag Mechanism

Single source of truth: `src/intelligence/flags.ts`.

**Pattern** (lines 12–83):
```ts
export const FLAGS = {
  PFOS_FIELD_MODE: process.env.PFOS_FIELD_MODE === 'true',
  PFOS_FIELD_CALC: process.env.PFOS_FIELD_CALC === 'true',
  // ...
} as const

export function isFlagEnabled(flag: FlagName): boolean {
  return FLAGS[flag]
}
```

- All flags default `false` unless the env var equals the string `'true'`. One exception: `PFOS_BILLING_WELDER_LIMIT` defaults `true` and requires `!== 'false'` to disable (`flags.ts:48`).
- Server-side check example: `src/app/(field)/layout.tsx:16` — `if (!FLAGS.PFOS_FIELD_MODE) redirect('/dashboard')`.
- Client-side: components import `FLAGS` directly (tree-shaken in production).
- Rollback docs referenced at `FEATURE_FLAGS.md` (repo root).

**Existing Field Mode flags relevant to this feature:**

| Flag | Default | Purpose |
|------|---------|---------|
| `PFOS_FIELD_MODE` | OFF | Master switch — gates the `(field)` layout |
| `PFOS_FIELD_CALC` | OFF | Calculator engine sub-flag |

**New flag to add for this feature:**
```
PFOS_FIELD_ISO_CALC: process.env.PFOS_FIELD_ISO_CALC === 'true'
```
Route guard: check both `FLAGS.PFOS_FIELD_MODE` and `FLAGS.PFOS_FIELD_ISO_CALC`.

---

## 3. Calculator Navigation & Field Mode Module

### Routes

- Calculator picker: `src/app/(field)/calc/page.tsx` — `CalcPickerPage`, renders a 2-column grid of cards.
- Dynamic calculator: `src/app/(field)/calc/[calculator]/page.tsx` — maps `params.calculator` slug → component via `CALCULATOR_MAP`.

**Adding ISO Tap-to-Calculate:** add a new card with `id: 'iso-tap-calc'`, `href: '/calc/iso-tap-calc'` in `CALCS` array (`calc/page.tsx:23–36`), and add a `CALCULATOR_MAP` entry (`calc/[calculator]/page.tsx:22–35`). The new component lives in `src/components/field-mode/calculators/IsoTapCalc.tsx`.

### Existing calculators

| ID | Component | File |
|----|-----------|------|
| `simple-offset` | `SimpleOffsetCalc` | `calculators/SimpleOffsetCalc.tsx` |
| `rolling-offset` | `RollingOffsetCalc` | `calculators/RollingOffsetCalc.tsx` |
| `parallel-offsets` | `ParallelOffsetsCalc` | `calculators/ParallelOffsetsCalc.tsx` |
| `cut-bw` | `CutLengthBwCalc` | `calculators/CutLengthBwCalc.tsx` |
| `cut-threaded` | `CutLengthThreadedCalc` | `calculators/CutLengthThreadedCalc.tsx` |
| `cut-sw` | `CutLengthSwCalc` | `calculators/CutLengthSwCalc.tsx` |
| `odd-angle` | `OddAngleCutCalc` | `calculators/OddAngleCutCalc.tsx` |
| `two-hole-flange` | `TwoHoleFlangeCalc` | `calculators/TwoHoleFlangeCalc.tsx` |
| `branch-layout` | `BranchLayoutCalc` | `calculators/BranchLayoutCalc.tsx` |
| `miter` | `MiterCalc` | `calculators/MiterCalc.tsx` |
| `pipe-weight` | `PipeWeightCalc` | `calculators/PipeWeightCalc.tsx` |
| `rigging` | `RiggingCalc` | `calculators/RiggingCalc.tsx` |
| `stud-lookup` | `StudLookupCalc` | `calculators/StudLookupCalc.tsx` |

### Fraction Keypad

`src/components/field-mode/FractionKeypad.tsx`

- Props: `{ value: string, onChange, onSubmit, unit: 'imperial' | 'metric' }`.
- All buttons: `min-h-[56px]` (glove-friendly). Decimal is a mode toggle, not default entry.
- Builds strings parseable by `fromFeetInchesFraction()` from `src/lib/field-mode/calc/types.ts`.
- Backspace: tap = delete one char; hold 600ms = clear all.
- **Reusable as-is** for ISO Tap-to-Calculate dimension entry.

### Existing geometry functions (`src/lib/field-mode/calc/offsets.ts`)

| Function | Inputs | Outputs | Assumptions |
|----------|--------|---------|-------------|
| `simpleOffset` | `offset + angle` OR `offset + run` | `travel, run, angle` | 2D, single elbow |
| `rollingOffset` | `rise, roll, angle` | `true_offset, travel, run, rotation` | two equal-angle elbows, parallel axes |
| `parallelOffsets` | 2–4 offset lines | per-line travel/run + clearance violations | independent 2D offsets |

`rollingOffset` at `offsets.ts:55–79` implements the Mode B geometry required by the spec (V, H, θ → T, U). The internal formula is `trueOffsetMm = hypot(rise, roll)`, `travel = trueOffset / sin(θ)`, `run = trueOffset / tan(θ)`. **This is directly reusable for Mode B** with documented assumption verification.

`simpleOffset` at `offsets.ts:36–71` covers the 2D case (roll=0 or rise=0).

**Mode A** (V, H, U known → T, θ_required) is **not yet implemented**. New function needed in `offsets.ts` or the new feature's engine file.

### Cut-length engines (`src/lib/field-mode/calc/cut-length.ts`)

Three async functions, all taking a `ReferenceAdapter`:

- `cutLengthButtWeld` (`cut-length.ts:59`) — takes `center_to_center`, list of `BwFittingSpec`, `assume_lr_standard` flag.
- `cutLengthSocketWeld` (`cut-length.ts:115`) — SW-specific, out of scope for this feature.
- `cutLengthThreaded` (`cut-length.ts:183`) — takes `center_to_center`, list of `ThreadedFittingSpec`.

**Critical finding for threaded cut length** (`cut-length.ts:209–222`): the existing `cutLengthThreaded` uses `total_makeup_l1_plus_l3_in` from `ref_npt_threads` as the "engagement/deduction". Per the spec, this is L1 (hand-tight) + L3 (wrench makeup), which is **not** final assembled insertion depth. The spec requires distinguishing these quantities and never substituting one for another without a source. The existing implementation uses the field `total_makeup_l1_plus_l3_in` directly as the per-end deduction — this is approximately correct for threading-in-place but the basis is not documented per-product. The new ISO Tap-to-Calculate threaded strategy must use a typed, explicitly-confirmed engagement record, not silently reuse the existing function.

### Unit/display helpers (`src/lib/field-mode/calc/types.ts`)

| Function | Purpose |
|----------|---------|
| `fromFeetInchesFraction(s)` | Parse string → `Length` (internal mm) |
| `fromMm`, `fromInches`, `fromMetres` | Construct `Length` |
| `toMm`, `toInches` | Extract value |
| `formatLength(l, opts)` | Display with rounding; only place rounding occurs |
| `dualFormat(mm)` | Both units |
| `fromDegrees`, `fromDegreesMinutes` | Parse angle strings |
| `toDegrees` | Extract |

The `Length` and `Angle` types are opaque branded types — they cannot be constructed without the factory functions. **These are directly reusable.**

**Gap in existing parser**: `fromFeetInchesFraction` does not handle:
- Signed values (negative lengths/differences)
- Unicode fraction characters (¾, etc.)
- Explicit rejection of NPS pipe-size callouts
- Ambiguous decimal/thousands separators

The spec's `Measurement` type requires a richer parser with source type (`ocr` | `manual`), raw text preservation, and structured error types — this is new work.

### Existing tests

- `src/lib/field-mode/calc/__tests__/offsets.test.ts` — covers simpleOffset, rollingOffset, parallelOffsets
- `src/lib/field-mode/calc/__tests__/cut-length.test.ts` — covers BW, SW, threaded
- `src/lib/field-mode/calc/__tests__/types.test.ts` — parser tests

---

## 4. Fitting/Reference Tables

### Schema summary (`supabase/migrations/20260829_field_mode_reference_tables.sql`)

Every reference table includes these provenance columns:
```sql
verified         BOOLEAN,
verified_by      TEXT,
verified_against TEXT,
verified_at      TIMESTAMPTZ,
recall_confidence TEXT,  -- 'high'|'medium'|'low'|'computed'|'unrated'|'source-photo'
source_doc       TEXT,
standard         TEXT,
edition          TEXT,
```

RLS: each table has `_read_all` (authenticated users) and `_write_owner` (platform_admin) policies.

### Relevant tables for this feature

| Table | Rows | verified=true | Source doc |
|-------|------|---------------|------------|
| `ref_bw_fittings` | 166 | **0** | `ref_bw_fittings_b16_9.csv` |
| `ref_threaded_fittings` | 56 | **0** | `ref_threaded_fittings_ctr_to_end.csv` |
| `ref_npt_threads` | 19 | **0** | `ref_npt_threads_b1_20_1.csv` |

**All rows have `verified=false`.** Source doc for every row is `claude-memory-2026-08-24 (recall); NOT an independent source`. Edition is `UNSPECIFIED-verify` across all rows.

Note: `ref_bw_fittings` has a separate `derived` column (42 of 166 rows = `true`) meaning the dimension was mathematically derived (e.g., 2A for a return), not that it was independently verified. The `verified` column is always false regardless.

**Consequence**: cut length is unavailable for **all** fittings in the existing catalog until at least one row per fitting/size combination receives `verified=true` from an independent source. The feature must ship geometry-only and display the gap clearly.

### How data is loaded client-side

`src/lib/field-mode/reference-adapter.ts` — calls `/api/field/ref` server route via `fetch`. The server route uses `createAdminClient` to bypass RLS (service role). Reference data is not cached in IndexedDB currently — it requires network access.

**Consequence for offline use**: Phase 4 must add IDB caching of the fitting/thread catalog before offline cut-length is possible.

### NPT thread data details (`ref_npt_threads_b1_20_1.csv`)

Columns include: `tpi`, `pitch_in`, `pitch_mm`, `handtight_L1_in`, `handtight_L1_mm`, `effective_thread_L2_in`, `wrench_makeup_L3_in`, `total_makeup_L1_plus_L3_in`.

**L1 (hand-tight)**, **L2 (effective thread length)**, and **L3 (wrench makeup)** are distinct. The existing `cutLengthThreaded` uses `L1+L3` as the per-end deduction. `final assembled insertion depth` (the distance the male thread end sits inside the female port after assembly) is a different quantity and is **not present** in any existing row. This is the Route 1 vs Route 2 distinction the spec requires.

---

## 5. Service Worker

Configured in `next.config.mjs` via `@ducanh2912/next-pwa@10.2.9` (Workbox).

- **Disabled** in development (`disable: process.env.NODE_ENV === 'development'`).
- **Output**: `public/sw.js` (no-cache headers applied at `next.config.mjs:108–113`).
- **Cache ID**: `pipefield-v2`.
- **Fallback document**: `/offline.html`.
- **Runtime caching**:
  - Supabase API: `NetworkFirst`, 24h, 200 entries.
  - Next.js static chunks: `CacheFirst`, 24h, 200 entries.
  - Next.js image optimisation: `StaleWhileRevalidate`.
- **Precache manifest**: generated by Workbox from the build output; covers app shell + static assets automatically.
- **OCR assets (Tesseract.js worker, Wasm, lang data)**: NOT currently cached — these do not exist yet in the project.

**Offline photo queue** (`src/lib/offline-queue.ts`): IndexedDB DB `pipefield-offline` version 3. Stores: `weld_queue`, `daily_report_queue`, `spool_queue`, `field_weld_queue`. 30-day TTL. Reusable pattern for ISO Tap-to-Calculate snapshots.

---

## 6. IndexedDB Abstraction

Library: `idb@8.0.3` (`package.json:46`).

**Existing DB** (`src/lib/offline-queue.ts`):
- DB name: `pipefield-offline`, schema version 3.
- Migrations: v1→v2 (added `daily_report_queue`, `spool_queue`), v2→v3 (added `field_weld_queue`).
- Error handling: write failures are surfaced via try/catch; failed items get `sync_status='failed'` with `sync_error`.
- Persistent storage: **not requested** in the existing code.
- Quota handling: not explicitly handled beyond try/catch.

**Second DB** (`src/lib/offline/pipeCalc.ts`): pure calculation module, no IDB.

**New IDB store needed for this feature**: `iso_calc_snapshots` store in a new or extended DB. Recommend extending `pipefield-offline` to version 4 with the new store, following the existing migration pattern.

---

## 7. Auth / Tenancy Pattern

### `getCallerProfile` (`src/lib/api-auth.ts:31`)

Two-strategy auth:
1. Bearer token from `Authorization` header (injected by `apiFetch()`).
2. Session cookie via `createServerClient` (standard SSR).

Returns `CallerProfile` with `{ id, auth_user_id, role, organization_id, full_name, status }` or `null`.

### `createAdminClient` usage

Used in: `src/lib/api-auth.ts`, `src/lib/supabase/admin.ts`, intelligence adapters, `src/lib/field-mode/reference-adapter.ts` (server-side via the `/api/field/ref` route). **Never called directly in client components** — only in server routes and scripts.

**For this feature**: any server API routes (e.g. snapshot save) must use `getCallerProfile`. Reference data reads continue through `/api/field/ref`. No `createAdminClient` in new client-side code.

### Session policy

See `src/lib/field-mode/SESSION_POLICY.md`. Access token TTL: 1h; refresh: 7 days. Middleware refreshes on every navigation. No re-auth challenge.

**Offline reopen**: current policy does not explicitly permit offline reopen of Field Mode without a token refresh. An existing session may work if the access token has not expired. Phase 4 must document this limitation.

---

## 8. Design System

### Color tokens (`tailwind.config.ts:12–35`)

- `surface-{50–950}`: CSS-variable-driven (flip on theme change).
- `brand-{50–950}`: PipeField orange (`#f97316` = brand-500).
- Semantic: `success=#22c55e`, `warning=#f59e0b`, `danger=#ef4444`, `info=#3b82f6`.

### Touch targets

- Spacing token `touch: '2.75rem'` (44px) defined in `tailwind.config.ts:46`.
- Convention in field calculators: `min-h-[56px]` for interactive elements (larger than the 44px minimum). See `FractionKeypad.tsx:29`, `calc/[calculator]/page.tsx:57`.

### Accessibility patterns observed

- `aria-label` on icon-only buttons (back buttons, keypad keys).
- `aria-hidden` on decorative SVGs.
- `onPointerDown` preferred over `onClick` in the keypad (glove-compatible, prevents ghost clicks).
- No `aria-live` regions observed in calculator components — this feature should add them for calculation result announcements.

### Diagram components

`src/components/field-mode/diagrams/` contains SVG-based diagrams for each calculator type. A `RollingOffsetDiagram.tsx` exists and shows rise/roll/travel geometry — directly reusable or adaptable for the offset confirmation step.

---

## 9. OCR / Image Libraries

**Tesseract.js**: NOT installed. Not in `package.json`, not in `node_modules`.

**Any other OCR/CV**: none found — `grep` for `tesseract`, `opencv`, `jimp`, `konva`, `canvas` in `package.json` returned no results.

**Image handling already present**:
- `src/lib/strip-exif.ts` — strips EXIF/APP1 segments from JPEG before AI processing. **Directly reusable** for ISO Tap-to-Calculate image ingestion.
- `src/app/api/v1/supports/identify/route.ts` — accepts image upload, strips EXIF, sends to OpenAI vision. This is a server route pattern to reference, not reuse directly.
- `src/lib/field-mode/calc/__tests__/` — no image-related tests.

**CSP note** (`next.config.mjs:27`): current `img-src` allows `self data: blob: *.supabase.co`. Tesseract.js worker scripts loaded from `blob:` would be blocked by the current `worker-src` (not explicitly set — defaults to `script-src`). **CSP must be updated** to add `worker-src blob:` for Tesseract workers.

**Bundle-size budget**: no explicit budget configured. Bundle analyzer available via `ANALYZE=true npm run build`.

**Tesseract.js v4/v5 size estimate**:
- `tesseract.js` package: ~1.5MB minified (worker + core separate).
- `tesseract-core.wasm`: ~3.5MB (downloaded at runtime or self-hosted).
- `eng.traineddata.gz`: ~4MB (English language data).
- Total offline footprint: ~9MB additional to self-host. Load only when flag is ON.

---

## 10. PDF / CAD Import Path

No general PDF-to-drawing or CAD import pipeline exists. Related:
- `mammoth@1.12.0` — .docx import for AI document embedding.
- `pdf-parse@2.4.5` — PDF text extraction for AI knowledge sources.
- Neither is used for isometric drawings. Both are in server-side intelligence adapter paths, not Field Mode.

**Conclusion**: no existing PDF/CAD import to reuse. Out of scope per spec.

---

## Proposed File Layout

```
src/features/iso-tap-calculate/
├── README.md                        # Feature README (Phase 5)
│
├── engines/                         # Phase 1 — pure TypeScript, no React/browser/DB
│   ├── measurement-parser.ts        # 1A: raw text → Measurement | ParseError | Ambiguity
│   ├── geometry-engine.ts           # 1B: Mode A (V,H,U) and Mode B (V,H,θ) — extends offsets.ts
│   ├── bw-strategy.ts               # 1C: butt-weld cut length strategy
│   ├── threaded-strategy.ts         # 1C: threaded NPT cut length strategy
│   ├── schemas.ts                   # Zod schemas for all engine I/O
│   └── __tests__/
│       ├── measurement-parser.test.ts
│       ├── geometry-engine.test.ts
│       ├── bw-strategy.test.ts
│       └── threaded-strategy.test.ts
│
├── catalog/                         # Phase 2 — catalog adapter + data provenance
│   ├── fitting-catalog-adapter.ts   # Adapter over existing ReferenceAdapter
│   ├── engagement-record.ts         # Project-entered engagement record type + Zod schema
│   ├── coverage-report.ts           # Data gap reporting
│   └── __tests__/
│       └── fitting-catalog.test.ts
│
├── storage/                         # Phase 4 — IndexedDB snapshot store
│   ├── snapshot-schema.ts           # IDB schema + migrations (extends pipefield-offline v4)
│   ├── snapshot-store.ts            # CRUD for iso_calc_snapshots
│   └── __tests__/
│       └── snapshot-store.test.ts
│
├── ocr/                             # Phase 3 — OCR adapter boundary
│   ├── ocr-adapter.ts               # Interface (lazy-loaded only when flag ON)
│   ├── tesseract-adapter.ts         # Tesseract.js implementation
│   └── types.ts                     # OcrRegion, BoundingBox, OcrResult
│
└── ui/                              # Phase 3 — React components
    ├── IsoTapCalc.tsx               # Top-level calculator component (registered in CALCULATOR_MAP)
    ├── ImageImportStep.tsx          # Step 1: import/capture + preview/crop/zoom/pan
    ├── ModeSelectStep.tsx           # Step 2: Mode A vs Mode B selection
    ├── DimensionConfirmStep.tsx     # Steps 3–4: field selection + OCR confirm
    ├── FittingSelectStep.tsx        # Step 5: BW or Threaded NPT, per-end fitting + gap/engagement
    ├── ResultsStep.tsx              # Step 6: geometry, deductions, warnings, save
    ├── EngagementRecordForm.tsx     # Project-entered engagement entry with provenance
    └── OverlayCanvas.tsx            # Bounding-box overlay (canonical image coords → viewport)
```

---

## Existing Modules to Reuse

| Module | Path | What to reuse |
|--------|------|---------------|
| Feature flags | `src/intelligence/flags.ts` | Add `PFOS_FIELD_ISO_CALC`; import `FLAGS`, `isFlagEnabled` |
| Calculator route picker | `src/app/(field)/calc/page.tsx` | Add new card to `CALCS` array (line 23) |
| Calculator dynamic route | `src/app/(field)/calc/[calculator]/page.tsx` | Add entry to `CALCULATOR_MAP` (line 22) |
| Fraction Keypad | `src/components/field-mode/FractionKeypad.tsx` | Direct reuse for manual dimension entry |
| Length / Angle opaque types | `src/lib/field-mode/calc/types.ts` | `fromMm`, `fromInches`, `formatLength`, `dualFormat`, `fromFeetInchesFraction`, `fromDegrees`, `fromDegreesMinutes` |
| `CalcResult` / `RefRow` / error types | `src/lib/field-mode/calc/types.ts` | Direct reuse |
| `rollingOffset` | `src/lib/field-mode/calc/offsets.ts:55` | Mode B geometry (V, H, θ → T, U) — verify assumptions |
| `ReferenceAdapter` interface | `src/lib/field-mode/calc/reference.ts` | `ThreadedFittingRow`, `NptThreadRow`, `BwFittingRow` |
| `createSupabaseReferenceAdapter` | `src/lib/field-mode/reference-adapter.ts` | Wrap for ISO Tap catalog adapter |
| Offline queue IDB pattern | `src/lib/offline-queue.ts` | Version migration pattern, `idb` usage |
| `stripExif` | `src/lib/strip-exif.ts` | Apply to imported images before any processing |
| `getCallerProfile` | `src/lib/api-auth.ts` | Server routes for snapshot save |
| Design tokens | `tailwind.config.ts` | `surface-*`, `brand-*`, `touch` spacing |
| Rolling offset diagram | `src/components/field-mode/diagrams/RollingOffsetDiagram.tsx` | Reference for geometry diagram in UI |
| Field locale | `src/lib/field-mode/locale.ts` | Add ISO Tap strings here |
| Offline reference cache | `src/lib/field-mode/offline-reference-cache.ts` | Extend for fitting catalog offline readiness |

---

## New Dependencies

| Dependency | Purpose | Size estimate | Notes |
|------------|---------|---------------|-------|
| `tesseract.js` ~5.x | OCR engine | ~1.5MB package JS; ~3.5MB core.wasm; ~4MB eng.traineddata | Self-host worker + Wasm + lang data. Lazy-load behind flag. Verify current API before using. |
| None others | — | — | `zod`, `idb`, `react-hook-form`, `sonner` already installed |

Total new bundle addition (when flag ON, lazy): ~9MB at first "prepare offline" download; nothing loaded when flag OFF.

**CSP change required**: add `worker-src blob:` to `ContentSecurityPolicy` in `next.config.mjs:27` so Tesseract.js worker `blob:` URL resolves.

---

## Open Questions

1. **`rollingOffset` reuse for Mode B**: `rollingOffset` (`offsets.ts:55`) accepts `{ rise, roll, angle }` and produces `{ travel, run, rotation }`. The rotation angle (`atan2(roll, rise)`) is computed but its reference convention is not documented in the source. The spec says "roll orientation only if the reference convention is explicitly labelled and tested; otherwise omit." **Decision needed**: document and expose the convention, or suppress it in the ISO Tap UI.

2. **Mode A gap**: no existing function computes `T = hypot(V, H, U)` and `θ = atan2(O, U)` from three known dimensions. A new function is needed. It can live in `src/features/iso-tap-calculate/engines/geometry-engine.ts` (additive, not modifying offsets.ts), or be added to `offsets.ts` as a new export. **Recommendation**: new file — keeps scope clean.

3. **Threaded catalog data (Route 1 vs Route 2)**: all 56 threaded fitting rows and all 19 NPT thread rows have `verified=false` and `source_doc = "claude-memory-2026-08-24 (recall); NOT an independent source"`. Route 1 (verified engagement catalog) will be **empty at pilot start**. Route 2 (project-entered values with named source) will be the only working path. **Question**: is there a Supabase table or org-approval policy for project-entered reference data already, or does Phase 2 need to define this? (Search found no existing `project_ref_` tables.)

4. **`cutLengthThreaded` existing behavior**: the existing function uses `L1+L3` from `ref_npt_threads` as the per-end engagement deduction without user confirmation of the basis. The ISO Tap-to-Calculate threaded strategy must not reuse this function for cut length — it needs its own explicitly-confirmed engagement record. **Confirm**: should the existing `cut-threaded` calculator be left unchanged (its users accept the current behavior), or updated? Recommendation: leave unchanged; the ISO Tap strategy is a separate typed implementation.

5. **Persistent storage request**: not currently requested (`navigator.storage.persist()` absent). Phase 4 should call it. **Confirm**: is the expected UX to silently request, or show a prompt explaining why?

6. **OCR worker CSP in Capacitor (iOS)**: the Capacitor WebView CSP is set in `ios/App/App/Info.plist` (NSAppTransportSecurity). Tesseract.js uses `blob:` worker URLs and Wasm — iOS WKWebView requires `wasm-eval` in the CSP (or `unsafe-eval` for older iOS). This needs testing. Currently `ITSAppUsesNonExemptEncryption=false` in plist — Wasm does not change this.

7. **Image ingestion in Capacitor**: `@capacitor/camera` is not installed (only `@capacitor/push-notifications`, `@capacitor-mlkit/barcode-scanning`). Camera capture for iOS will need either `@capacitor/camera` (new dep, ~small) or the native `<input type="file" accept="image/*" capture="environment">` approach (zero new dep, supported in WKWebView). **Recommendation**: use file input — no new native package needed, works in browser and iOS PWA/Capacitor.

8. **`ref_threaded_fittings` standard column**: rows show `"ASME B16.11 forged, class 2000"` as the standard, mixed with `"ASME B16.3 malleable"` — or are all rows B16.11? The spec explicitly forbids treating B16.3 and B16.11 as interchangeable. **Need to verify** the actual standard distribution in the CSV and confirm the `standard` column is populated correctly before the catalog adapter filters on it.

9. **`FEATURE_FLAGS.md`**: referenced in `flags.ts:7` but not present in the repo root (only `flags.ts` was found). Either it was never created or it lives elsewhere. Phase 1 should create or locate it.

10. **Offline readiness for reference data**: `createSupabaseReferenceAdapter` uses `fetch` to `/api/field/ref` — this fails offline. `src/lib/field-mode/offline-reference-cache.ts` exists but its implementation needs review to confirm it can cache fitting/thread rows for offline use. If it cannot, Phase 4 must extend it or add a separate catalog cache in IDB.

---

*End of Phase 0. Awaiting `APPROVED: PHASE 0`.*
