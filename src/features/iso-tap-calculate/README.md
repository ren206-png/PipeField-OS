# ISO Tap-to-Calculate

A pipefitter photographs a piping isometric, confirms written dimensions, and gets deterministic offset geometry and — where verified fitting data exists — straight-pipe cut length. Manual entry works end to end without OCR.

Supports butt-weld (BW) and threaded NPT connection strategies. All other connection families are out of scope.

---

## How to enable

```
PFOS_FIELD_ISO_CALC=true   # this feature
PFOS_FIELD_MODE=true       # master Field Mode switch (required)
```

Available to: **Field Pro, Starter, Professional, Enterprise** plans.  
Not available on free trial (`requirePlanTier(org, 'field_pro')`).

When `PFOS_FIELD_ISO_CALC=false`: the calculator card is not rendered, the route is absent from `CALCULATOR_MAP`, and no OCR assets are loaded. Nothing is imported from this feature tree.

---

## How to test offline

1. Enable the feature flag and open the calculator in a supported browser.
2. In the Results step, tap **Prepare for offline use**.
3. The app downloads OCR assets (~9 MB: worker JS + Wasm + eng.traineddata) and verifies their presence.
4. "Ready for offline use" is shown only after all assets are verified — not before.
5. Reload with network blocked; import a new image, run the full calculate-and-save flow — zero successful network requests should be required.

**Known limitation:** offline reopen requires a valid session token (~1 h TTL with Supabase). After expiry the user must reconnect online to refresh the token. The app shows this limitation; it does not claim permanent offline access.

**OCR assets not yet self-hosted** — `public/iso-calc-ocr/` does not yet contain the Tesseract files. Offline OCR will fail until those files are downloaded and placed there (see Proposed work below).

---

## Supported inputs / geometry / fitting matrix

### Geometry modes

| Mode | Inputs | Outputs | Notes |
|------|--------|---------|-------|
| Mode A | V (rise), H (roll), U (run) — confirmed mm or in | T (travel), θ_required | θ is never rounded; a fitting angle mismatch blocks cut length |
| Mode B | V (rise), H (roll), θ (elbow angle) | T (travel), U (run) | T = centreline-intersection-to-centreline-intersection, not face-to-face |

### Connection strategies

| Strategy | Requires | Cut length when | Notes |
|----------|----------|-----------------|-------|
| Geometry only | — | Never (always available) | Use when no fitting data or not needed |
| Butt-weld | verified=true BW deductions + confirmed root gaps | ≥1 verified row exists | 0 verified rows at pilot start |
| Threaded NPT | verified face dims + project-entered engagement | face dims verified + engagement confirmed | Route 2 (project-entered) only at pilot start |

### Thread families

| Thread family | Supported |
|---------------|-----------|
| NPT | Yes |
| BSPT | No — rejected |
| BSPP | No — rejected |
| NPTF | No — rejected |
| NPSM | No — rejected |
| Unknown / mixed | No — rejected |

---

## Data coverage report (current state, pilot start)

| Table | Rows | verified=true | Source |
|-------|------|---------------|--------|
| `ref_bw_fittings` | 166 | **0** | `claude-memory-2026-08-24 (recall); NOT an independent source` |
| `ref_threaded_fittings` | 56 | **0** | same |
| `ref_npt_threads` | 19 | **0** | same |

**Cut length is unavailable for all fittings** until at least one row per size/angle is independently verified.

**What unblocks BW cut length:** cross-check deductions against ASME B16.9 (or equivalent), set `verified=true`, add source doc + edition + verifier.

**What unblocks threaded cut length:**
- Face dimensions: cross-check against ASME B16.3 / B16.11 source.
- Engagement: Route 2 project-entered with named manufacturer reference or documented measured assembly. Route 1 (verified catalog) is empty and not required for first use.

---

## New dependencies

| Package | Version | Purpose | Bundle impact |
|---------|---------|---------|---------------|
| `tesseract.js` | 5.x | OCR engine | ~1.5 MB JS + ~3.5 MB Wasm + ~4 MB eng.traineddata. Lazy-loaded only when flag ON; zero impact when flag OFF. |
| `fake-indexeddb` | devDep | Jest IDB polyfill | 0 production impact |

---

## Known limitations

- Cut length unavailable at pilot start — all fitting data unverified.
- Route 1 (verified engagement catalog) is empty; Route 2 (project-entered) is the only threaded path.
- OCR assets (~9 MB) must be self-hosted in `public/iso-calc-ocr/` for offline use. Not yet downloaded — `prepareForOffline()` will fail until those files are placed there.
- iOS WKWebView may require `wasm-eval` in CSP for Tesseract Wasm. Pending device verification.
- Session token ~1 h TTL — offline reopen fails after expiry.
- `onAccountSwitch` is wired in `src/providers/AuthProvider.tsx` (SIGNED_OUT handler, line ~192) via `stateRef` to clear snapshots and images on sign-out. It is namespace separation, not encryption.
- Overlay box tap hit-testing uses SVG pointer events — verified in Chrome; mobile touch behaviour pending device test.

---

## Device checklist (pending)

| Device | Test | Result |
|--------|------|--------|
| iPhone (Safari PWA) | Form entry, OCR, save/reopen | PENDING |
| iPhone (Capacitor) | Camera capture, EXIF strip, Wasm CSP | PENDING |
| Android Chrome | Form entry, file input `capture="environment"` | PENDING |

---

## Pilot protocol

5–10 pipefitters. Authorized drawings only. Butt-weld and threaded tasks reported separately.

**Method:** manual calculator vs ISO Tap workflow on matched tasks with alternating order. Measure:
- Total time including photo preparation
- Number of OCR corrections required
- Discrepancies vs independently checked answers
- Failure rate (task abandoned or incorrect result)
- Voluntary repeat use

**Decision target:** ≥25% lower median task time with no increase in final errors.  
This is a *decision target*, not proof of safety or demand.

Timing and count events via existing consented analytics only. No images, dimensions, or drawing IDs are sent.

---

## Adversarial self-check

### 1. Where could a `verified=false` row reach a cut-length result?

**Answer: Nowhere in the current implementation.**

`computeBwCutLength` (`bw-strategy.ts:24`) explicitly checks `fittingA.verified` and `fittingB.verified`; a `false` value returns a `BwError` before any arithmetic runs. The `IsoCatalogAdapter.getBwDeductions()` (`catalog/fitting-catalog-adapter.ts`) filters to `verified=true` rows only before returning them to the UI. The `FittingSelectStep` UI shows "No verified data" when `getBwDeductions` returns an empty array. There is no path from an unverified row to a `BwResult`.

Threaded: `validateFitting` (`threaded-strategy.ts:44`) checks `faceDistanceVerified` and rejects `false`. Engagement is project-entered and confirmed separately. No catalog row reaches a threaded result without explicit user confirmation.

### 2. Where could a butt-weld gap survive a switch to threaded mode?

**Answer: Nowhere — discriminated union enforces isolation.**

The snapshot `strategy` field is a Zod `discriminatedUnion('type', [...])`. The `butt-weld` variant contains `gapAMm`/`gapBMm`; the `threaded-npt` variant does not. Switching strategy in the UI discards the previous strategy state entirely — `IsoTapCalc.tsx` holds strategy result in a `useState` that is reset when the mode changes. The engines are pure functions with separate typed inputs (`BwInput` vs `ThreadedInput`); there is no shared mutable state between them.

Integration test in `__tests__/integration.test.ts` (Test B) asserts `retrieved!.strategy.gapAMm === undefined` after a threaded round-trip.

### 3. Where could engagement be added twice?

**Answer: Nowhere — the formula adds E only once.**

`computeFromC` (`threaded-strategy.ts:133`): `cutLengthMm = c - F1 + E1 - F2 + E2`. E1 and E2 appear exactly once. The breakdown object stores `e1`, `e2`, `d1 = F1 - E1`, `d2 = F2 - E2` — these are derivations for display, not additional inputs to the formula. The existing `cutLengthThreaded` in `cut-length.ts` (which uses `L1+L3` as a deduction) is NOT called by this feature — it is a separate implementation.

Unit tests in `__tests__/threaded-strategy.test.ts` verify the fixture `C=1000, F1=40, F2=45, E1=12, E2=14 → Lcut=941` and the directional test `+1 mm E ⇒ +1 mm Lcut`.

### 4. Where could an unconfirmed OCR value feed a calculation?

**Answer: Nowhere — `confirmed=false` blocks the Calculate button.**

`DimensionEntryStep.tsx`: the Calculate button is disabled until every required field has `confirmed === true` (checked inline before calling `computeModeA`/`computeModeB`). `parseMeasurement` always returns `confirmed: false` — the user must explicitly tick a confirm checkbox per field to set it `true`. The geometry engines (`computeModeA`, `computeModeB`) each guard `if (!input.X.confirmed) return geoError(...)` as their first check.

There is no code path that sets `confirmed = true` automatically from an OCR result.

### 5. Where does an overlay box drift after rotation + zoom?

**Potential drift: `OverlayCanvas.tsx` resize handling.**

`OverlayCanvas.tsx` uses a `ResizeObserver` to recompute the scale transform when the container size changes. The transform chain is: canonical pixel coords → `rotatePoint()` → scale by `(viewportWidth / rotatedImageWidth)`. If `ResizeObserver` fires before the `<img>` element reports its new `naturalWidth`/`naturalHeight` (which stay fixed regardless of viewport), the scaled coordinates are correct. However: if the image `src` changes (new image loaded) and `imageNaturalWidth`/`imageNaturalHeight` props are stale at the moment the observer fires, boxes could drift one frame until the parent re-renders with correct natural dimensions. Mitigation: parent (`ImageImportStep`) should reset `naturalWidth`/`naturalHeight` to 0 before setting the new image src, so stale boxes are not rendered. **Pending device verification.**

### 6. What happens on account switch with records in IndexedDB?

`onAccountSwitch(userId, organizationId)` is called from `AuthProvider.tsx` on `SIGNED_OUT` events, using `stateRef.current` to read the departing user's userId and organizationId. It calls `clearSnapshotsForUser` + `clearImagesForUser` — both filter by `userId AND organizationId` and delete only matching records.

If the user switches to a different account without signing out (e.g. direct URL navigation), `onAccountSwitch` is not called — records from the previous account remain in IDB until that account's next sign-out. This is namespace separation, not encryption; a determined actor with DevTools access could read the raw IDB. Do not store sensitive pipe dimensions in contexts where this is a concern.

### 7. What does the user see when offline readiness was true and one asset is now evicted?

`checkOfflineReadiness()` (`storage/offline-readiness.ts`) uses `caches.match()` to verify each OCR asset path. If a browser evicts a cached asset (which can happen under storage pressure), `caches.match()` returns `undefined` for that path and the function returns `{ ready: false, missingResources: ['...'] }`. `loadPersistedReadiness()` reads from `localStorage`; if the cached status says `ready: true` but `checkOfflineReadiness()` now says `false`, the UI should re-check on load (the caller is responsible for not showing a stale `true`). The `ResultsStep` placeholder says "Prepare for offline use" — it must re-run `checkOfflineReadiness()` on open, not cache the result. **Caller convention to enforce in Phase integration — not yet wired in the UI.**

### 8. Which test expectations came from the implementation instead of independent values?

**None in the Phase 1–5 test suite.** All fixture values are stated in `integration.test.ts` with hand-computation commentary:

- `T = sqrt(610000) = 781.0249675906654` — verified by WolframAlpha, stated before any code existed.
- `θ = atan2(500, 600)` — stated in spec.
- `T = 500√2 = 707.1067811865476` — mathematical identity.
- `Lcut = 781.024... − 116 = 665.024...` — arithmetic from spec fixtures.
- `Lcut threaded = 707.106... − 59 = 648.106...` — arithmetic from spec fixtures.

The Phase 1 geometry fixtures (`geometry-engine.test.ts`) were written before the implementation based on the spec's pre-stated values. The threaded strategy fixtures match the spec's synthetic examples exactly.

---

## Implemented vs proposed

### Implemented

- **Phase 1** — Measurement parser (21 tests), geometry engine Mode A + Mode B (17 tests), BW strategy (9 tests), threaded NPT strategy (22 tests), Zod schemas. 69 unit tests.
- **Phase 2** — Fitting catalog adapter, engagement record (Route 2), coverage report. 21 unit tests.
- **Phase 3** — Full UI wizard (5 steps: ImageImport → ModeSelect → DimensionEntry → FittingSelect → Results), OCR adapter boundary, Tesseract.js lazy-load (never loaded when flag OFF), OverlayCanvas with canonical-to-viewport transform, tier gate (Field Pro+), CSP `worker-src blob:` update.
- **Phase 4** — IDB snapshot store, image blob store, offline readiness checker, account separation. 9 unit tests. DB `pipefield-offline` extended to v5.
- **Phase 5** — Integration tests (9), `onAccountSwitch` wired to `AuthProvider.tsx` SIGNED_OUT handler, README, delivery summary.

**Total tests: 245 passing, 0 failing.**

### Proposed (not implemented)

- Self-host OCR assets in `public/iso-calc-ocr/` — Tesseract worker JS, Wasm, eng.traineddata (~9 MB). Required for offline OCR.
- Wire OCR region-tap to dimension entry (Tesseract region recognition → `parseMeasurement`).
- Verify fitting data against independent source (ASME B16.9, B16.3, B16.11) to enable Route 1 cut length.
- Route 1 verified engagement catalog (server table + approval policy).
- Device E2E tests (iPhone Safari/PWA, Capacitor, Android Chrome).
- Playwright E2E: flag-off verifies no route + no OCR load.
- Pilot study per protocol above.

### Not production-ready because

- All fitting data unverified (cut length unavailable for all sizes).
- OCR assets not self-hosted (offline OCR non-functional).
- iOS WKWebView CSP for Wasm not device-tested.
- No device E2E tests run.
- `checkOfflineReadiness()` result not re-validated on UI open (stale-readiness gap noted above).
