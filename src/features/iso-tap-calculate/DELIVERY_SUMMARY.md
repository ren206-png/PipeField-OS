# ISO Tap-to-Calculate — Delivery Summary

## What shipped

All five phases complete. 245 tests passing, 0 failing. `tsc --noEmit` clean. Production build clean.

| Phase | Deliverable | Tests |
|-------|-------------|-------|
| 1 | Measurement parser, geometry engine (Mode A + B), BW strategy, threaded NPT strategy, Zod schemas | 69 |
| 2 | Fitting catalog adapter, engagement record (Route 2), coverage report | 21 |
| 3 | 5-step UI wizard, OCR adapter, Tesseract.js lazy-load, OverlayCanvas, tier gate, CSP update | 0 (UI) |
| 4 | IDB snapshot + image store, offline readiness, account separation | 9 |
| 5 | Integration tests, onAccountSwitch wired, README, this file | 9 |

## How to enable

```
PFOS_FIELD_MODE=true
PFOS_FIELD_ISO_CALC=true
```

Available to Field Pro, Starter, Professional, Enterprise. Free trial is blocked.

## What's blocked

| Blocker | Impact | Fix |
|---------|--------|-----|
| All 166 BW + 56 threaded fitting rows `verified=false` | Cut length unavailable for all fittings | Cross-check against ASME B16.9 / B16.3 / B16.11; set `verified=true` |
| OCR assets not in `public/iso-calc-ocr/` | Offline OCR non-functional; `prepareForOffline()` fails | Download Tesseract worker, Wasm, eng.traineddata into that folder |
| iOS Wasm CSP untested | Capacitor OCR may fail on-device | Test `wasm-eval` CSP on WKWebView |
| OCR not wired to dimension entry | "Tap region" button is a placeholder | Implement Tesseract region-recognition flow |

## What's next

1. Download and pin OCR assets to `public/iso-calc-ocr/` (~9 MB).
2. Wire OCR tap-to-recognize into `DimensionEntryStep`.
3. Verify one BW fitting row against ASME B16.9 to unblock cut length.
4. Run device E2E tests (iPhone Safari, Capacitor, Android Chrome).
5. Pilot study (5–10 pipefitters, matched tasks, target ≥25% lower median time).
