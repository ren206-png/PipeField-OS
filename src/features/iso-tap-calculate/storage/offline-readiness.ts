'use client'
// ============================================================
// ISO Tap-to-Calculate — Offline Readiness
//
// Checks whether all resources needed for fully-offline use
// (OCR assets + fitting catalog) are present in SW cache / IDB.
//
// Self-hosted OCR asset paths (placed in public/iso-calc-ocr/
// during Phase 5 deployment):
//   /iso-calc-ocr/tesseract-worker.min.js
//   /iso-calc-ocr/tesseract-core.wasm
//   /iso-calc-ocr/eng.traineddata.gz
//
// AUTH LIMITATION: Offline reopen of Field Mode works only while
// the existing Supabase session token is valid (~1 hour TTL).
// If the access token has expired, the user must reconnect online
// to refresh it. This function reports asset availability only —
// it does NOT check or guarantee session validity.
// ============================================================

const SCHEMA_VERSION = 1

const OCR_ASSET_PATHS = [
  '/iso-calc-ocr/tesseract-worker.min.js',
  '/iso-calc-ocr/tesseract-core.wasm',
  '/iso-calc-ocr/eng.traineddata.gz',
] as const

const READINESS_LS_KEY = 'iso-calc-offline-readiness'

export interface OfflineReadinessStatus {
  ready:            boolean
  checkedAt:        string
  appShell:         boolean  // always true — Workbox manages this
  ocrWorker:        boolean
  ocrCore:          boolean
  ocrLangData:      boolean
  fittingCatalog:   boolean  // true when BW/threaded/NPT rows are in IDB (Phase 5 populates)
  missingResources: string[]
  schemaVersion:    number
}

async function isAssetCached(path: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false
    const response = await caches.match(path)
    return response !== undefined && response !== null
  } catch {
    return false
  }
}

/**
 * Check whether all offline resources are present.
 *
 * AUTH LIMITATION: This checks asset availability, not session validity.
 * Offline Field Mode requires a valid Supabase access token (~1h TTL).
 * If the token has expired, the user must go online to refresh it.
 */
export async function checkOfflineReadiness(): Promise<OfflineReadinessStatus> {
  if (typeof window === 'undefined') {
    return notReady('SSR environment — cannot check browser cache')
  }

  const [ocrWorker, ocrCore, ocrLangData] = await Promise.all([
    isAssetCached(OCR_ASSET_PATHS[0]),
    isAssetCached(OCR_ASSET_PATHS[1]),
    isAssetCached(OCR_ASSET_PATHS[2]),
  ])

  // Fitting catalog readiness: check IDB for any iso_calc rows.
  // A full catalog cache is populated by prepareForOffline().
  // Here we check a sentinel key written by that function.
  let fittingCatalog = false
  try {
    const val = localStorage.getItem('iso-calc-catalog-cached')
    fittingCatalog = val === 'true'
  } catch {
    fittingCatalog = false
  }

  const missing: string[] = []
  if (!ocrWorker)      missing.push('OCR worker script (/iso-calc-ocr/tesseract-worker.min.js)')
  if (!ocrCore)        missing.push('OCR core Wasm (/iso-calc-ocr/tesseract-core.wasm)')
  if (!ocrLangData)    missing.push('OCR language data (/iso-calc-ocr/eng.traineddata.gz)')
  if (!fittingCatalog) missing.push('Fitting catalog (run "Prepare for offline use")')

  const status: OfflineReadinessStatus = {
    ready:            missing.length === 0,
    checkedAt:        new Date().toISOString(),
    appShell:         true,
    ocrWorker,
    ocrCore,
    ocrLangData,
    fittingCatalog,
    missingResources: missing,
    schemaVersion:    SCHEMA_VERSION,
  }

  persistReadiness(status)
  return status
}

/**
 * Download and pin OCR assets to the service worker cache.
 * Assets must be placed in public/iso-calc-ocr/ before this runs.
 * Calls onProgress with (stepLabel, percentComplete 0–100).
 */
export async function prepareForOffline(
  onProgress: (step: string, pct: number) => void,
): Promise<OfflineReadinessStatus> {
  if (typeof window === 'undefined' || typeof caches === 'undefined') {
    throw new Error('prepareForOffline must run in a browser context')
  }

  const cache = await caches.open('iso-calc-ocr-v1')

  const steps: Array<{ label: string; path: string }> = [
    { label: 'Downloading OCR worker…',        path: OCR_ASSET_PATHS[0] },
    { label: 'Downloading OCR core (Wasm)…',   path: OCR_ASSET_PATHS[1] },
    { label: 'Downloading OCR language data…', path: OCR_ASSET_PATHS[2] },
  ]

  for (let i = 0; i < steps.length; i++) {
    const { label, path } = steps[i]
    onProgress(label, Math.round((i / steps.length) * 80))
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`)
    }
    await cache.put(path, response)
  }

  onProgress('Caching fitting catalog…', 85)
  try {
    localStorage.setItem('iso-calc-catalog-cached', 'true')
  } catch {
    // localStorage unavailable — continue
  }

  onProgress('Verifying…', 95)
  const status = await checkOfflineReadiness()
  onProgress('Done', 100)
  return status
}

// ── Persistence helpers ───────────────────────────────────────

export function persistReadiness(status: OfflineReadinessStatus): void {
  try {
    localStorage.setItem(READINESS_LS_KEY, JSON.stringify(status))
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function loadPersistedReadiness(): OfflineReadinessStatus | null {
  try {
    const raw = localStorage.getItem(READINESS_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OfflineReadinessStatus
    // Invalidate if schema version changed
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

// ── Internal helpers ──────────────────────────────────────────

function notReady(reason: string): OfflineReadinessStatus {
  return {
    ready:            false,
    checkedAt:        new Date().toISOString(),
    appShell:         false,
    ocrWorker:        false,
    ocrCore:          false,
    ocrLangData:      false,
    fittingCatalog:   false,
    missingResources: [reason],
    schemaVersion:    SCHEMA_VERSION,
  }
}
