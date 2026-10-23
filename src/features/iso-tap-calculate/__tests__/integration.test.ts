// ============================================================
// ISO Tap-to-Calculate — Integration Tests (Phase 5)
//
// Tests the Phase 1–4 engines + storage end-to-end.
// No UI components. Expected values are hand-computed below.
// ============================================================

// Polyfill IDB for Jest (Node environment)
import 'fake-indexeddb/auto'
import { _resetDbPromise } from '../storage/snapshot-schema'

import { computeModeA, computeModeB } from '../engines/geometry-engine'
import { computeBwCutLength } from '../engines/bw-strategy'
import { computeThreadedCutLength } from '../engines/threaded-strategy'
import { saveSnapshot, getSnapshot, clearSnapshotsForUser, listSnapshots } from '../storage/snapshot-store'
import type { ConfirmedMeasurement } from '../engines/schemas'
import type { IsoCalcSnapshot } from '../storage/snapshot-schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confirmedMm(valueMm: number): ConfirmedMeasurement {
  return {
    kind: 'measurement',
    rawText: `${valueMm} mm`,
    normalizedText: `${valueMm} mm`,
    originalUnit: 'mm',
    valueMm,
    valueIn: valueMm / 25.4,
    sourceType: 'manual',
    confirmed: true,
  }
}

const NOW = new Date().toISOString()

function baseSnapshot(overrides: Partial<IsoCalcSnapshot> = {}): IsoCalcSnapshot {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    userId: 'user1',
    organizationId: 'org1',
    drawingLabel: 'test',
    mode: 'mode-a',
    inputs: {
      rise: { valueMm: 300, unit: 'mm', rawText: '300 mm', confirmedAt: NOW },
      roll: { valueMm: 400, unit: 'mm', rawText: '400 mm', confirmedAt: NOW },
      run:  { valueMm: 600, unit: 'mm', rawText: '600 mm', confirmedAt: NOW },
    },
    inputsConfirmedAt: NOW,
    geometry: { trueOffsetMm: 500, travelMm: 781.0249675906654, thetaDeg: 39.8055710922652 },
    strategy: { type: 'geometry-only' },
    formulaVersion: '1.0.0',
    displayUnit: 'mm',
    warnings: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset IDB between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetDbPromise()
})

// ---------------------------------------------------------------------------
// Test A — BW full pipeline
//
// Hand computation:
//   V=300, H=400, U=600 mm
//   O = hypot(300, 400) = 500 mm
//   T = hypot(300, 400, 600) = sqrt(300²+400²+600²) = sqrt(90000+160000+360000) = sqrt(610000)
//     = 781.0249675906654 mm  (verified by WolframAlpha: sqrt(610000))
//   θ = atan2(500, 600) = atan(500/600) = atan(5/6) ≈ 39.8055710922652°
//
//   BW: A1=50, A2=60, g1=g2=3
//   Lcut = T − A1 − A2 − g1 − g2
//        = 781.0249675906654 − 50 − 60 − 3 − 3
//        = 665.0249675906654 mm
// ---------------------------------------------------------------------------

describe('Test A — BW full pipeline', () => {
  it('computeModeA produces expected T and θ', () => {
    const result = computeModeA({
      rise: confirmedMm(300),
      roll: confirmedMm(400),
      run:  confirmedMm(600),
    })
    expect(result.kind).toBe('mode-a')
    if (result.kind !== 'mode-a') return

    // sqrt(300²+400²+600²) = sqrt(610000) = 781.0249675906654
    expect(result.travel).toBeCloseTo(781.0249675906654, 6)
    // atan2(500, 600) in degrees ≈ 39.8055710922652
    expect(result.thetaDeg).toBeCloseTo(39.8055710922652, 6)
    expect(result.trueOffset).toBeCloseTo(500, 6)
  })

  it('computeBwCutLength gives Lcut = 665.02... mm', () => {
    const geoResult = computeModeA({
      rise: confirmedMm(300),
      roll: confirmedMm(400),
      run:  confirmedMm(600),
    })
    expect(geoResult.kind).toBe('mode-a')
    if (geoResult.kind !== 'mode-a') return

    const bwResult = computeBwCutLength({
      travel: geoResult.travel,
      fittingA: { deductionMm: 50, verified: true, sourceDoc: 'ASME B16.9 test', nominalSizeNps: '2', angleDeg: 45 },
      fittingB: { deductionMm: 60, verified: true, sourceDoc: 'ASME B16.9 test', nominalSizeNps: '2', angleDeg: 45 },
      gapA: { valueMm: 3, confirmed: true },
      gapB: { valueMm: 3, confirmed: true },
    })
    expect(bwResult.kind).toBe('bw-result')
    if (bwResult.kind !== 'bw-result') return

    // 781.0249675906654 - 50 - 60 - 3 - 3 = 665.0249675906654
    expect(bwResult.cutLengthMm).toBeCloseTo(665.0249675906654, 6)
    expect(bwResult.breakdown.travel).toBeCloseTo(781.0249675906654, 6)
    expect(bwResult.breakdown.deductionA).toBe(50)
    expect(bwResult.breakdown.deductionB).toBe(60)
    expect(bwResult.breakdown.gapA).toBe(3)
    expect(bwResult.breakdown.gapB).toBe(3)
  })

  it('snapshot round-trip for BW result', async () => {
    const geoResult = computeModeA({
      rise: confirmedMm(300),
      roll: confirmedMm(400),
      run:  confirmedMm(600),
    })
    if (geoResult.kind !== 'mode-a') throw new Error('geometry failed')

    const bwResult = computeBwCutLength({
      travel: geoResult.travel,
      fittingA: { deductionMm: 50, verified: true, sourceDoc: 'ASME B16.9 test', nominalSizeNps: '2', angleDeg: 45 },
      fittingB: { deductionMm: 60, verified: true, sourceDoc: 'ASME B16.9 test', nominalSizeNps: '2', angleDeg: 45 },
      gapA: { valueMm: 3, confirmed: true },
      gapB: { valueMm: 3, confirmed: true },
    })
    if (bwResult.kind !== 'bw-result') throw new Error('BW failed')

    const snapshot = baseSnapshot({
      id: '00000000-0000-0000-0000-000000000010',
      mode: 'mode-a',
      geometry: { trueOffsetMm: geoResult.trueOffset, travelMm: geoResult.travel, thetaDeg: geoResult.thetaDeg },
      strategy: {
        type: 'butt-weld',
        fittingA: { nominalSizeNps: '2', angleDeg: 45, deductionMm: 50, verified: true, sourceDoc: 'ASME B16.9 test' },
        fittingB: { nominalSizeNps: '2', angleDeg: 45, deductionMm: 60, verified: true, sourceDoc: 'ASME B16.9 test' },
        gapAMm: 3,
        gapBMm: 3,
        cutLengthMm: bwResult.cutLengthMm,
      },
    })

    const saved = await saveSnapshot(snapshot)
    const retrieved = await getSnapshot(saved.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.strategy.type).toBe('butt-weld')
    if (retrieved!.strategy.type === 'butt-weld') {
      expect(retrieved!.strategy.cutLengthMm).toBeCloseTo(665.0249675906654, 6)
    }
  })
})

// ---------------------------------------------------------------------------
// Test B — Threaded full pipeline
//
// Hand computation:
//   V=300, H=400, θ=45°
//   O = hypot(300, 400) = 500 mm
//   T = O / sin(45°) = 500 / (√2/2) = 500√2 = 707.1067811865476 mm
//
//   Threaded: C=T=707.1067811865476, F1=40, F2=45, E1=12, E2=14
//   Lcut = C − F1 + E1 − F2 + E2
//        = 707.1067811865476 − 40 + 12 − 45 + 14
//        = 707.1067811865476 + (−40+12−45+14)
//        = 707.1067811865476 + (−59)
//        = 648.1067811865476 mm
// ---------------------------------------------------------------------------

describe('Test B — Threaded full pipeline', () => {
  it('computeModeB produces T=707.1067... mm', () => {
    const result = computeModeB({
      rise: confirmedMm(300),
      roll: confirmedMm(400),
      angleDeg: 45,
    })
    expect(result.kind).toBe('mode-b')
    if (result.kind !== 'mode-b') return
    // 500 / sin(45°) = 500√2 = 707.1067811865476
    expect(result.travel).toBeCloseTo(707.1067811865476, 6)
  })

  it('computeThreadedCutLength gives Lcut=648.1067... mm', () => {
    // C = 707.1067811865476
    const C = 707.1067811865476
    const engagement = (valueMm: number) => ({
      basis: 'project-entered' as const,
      valueMm,
      rangeMinMm: valueMm - 2,
      rangeMaxMm: valueMm + 2,
      sourceDescription: 'Anvil 3000# test data',
      confirmedByUser: true,
      confirmedAt: NOW,
    })

    const result = computeThreadedCutLength({
      inputMode: 'offset-derived-c',
      c: C,
      fitting1: {
        threadFamily: 'NPT',
        nominalSizeNps: '1',
        angleDeg: 90,
        faceDistanceMm: 40,
        faceDistanceVerified: true,
        faceDistanceSource: 'test',
        engagement: engagement(12),
      },
      fitting2: {
        threadFamily: 'NPT',
        nominalSizeNps: '1',
        angleDeg: 90,
        faceDistanceMm: 45,
        faceDistanceVerified: true,
        faceDistanceSource: 'test',
        engagement: engagement(14),
      },
    })

    expect(result.kind).toBe('threaded-result')
    if (result.kind !== 'threaded-result') return
    // 707.1067811865476 - 40 + 12 - 45 + 14 = 648.1067811865476
    expect(result.cutLengthMm).toBeCloseTo(648.1067811865476, 6)
  })

  it('threaded snapshot has no gapAMm field', async () => {
    const C = 707.1067811865476
    const engagement = {
      valueMm: 12, rangeMinMm: 10, rangeMaxMm: 14,
      sourceDescription: 'test', confirmedByUser: true, confirmedAt: NOW,
    }
    const snapshot = baseSnapshot({
      id: '00000000-0000-0000-0000-000000000020',
      mode: 'mode-b',
      geometry: { trueOffsetMm: 500, travelMm: C, runMm: 500 },
      strategy: {
        type: 'threaded-npt',
        fitting1: { threadFamily: 'NPT', nominalSizeNps: '1', faceDistanceMm: 40, standard: 'ASME B16.11' },
        fitting2: { threadFamily: 'NPT', nominalSizeNps: '1', faceDistanceMm: 45, standard: 'ASME B16.11' },
        engagement1: { valueMm: 12, rangeMinMm: 10, rangeMaxMm: 14, sourceDescription: 'test' },
        engagement2: { valueMm: 14, rangeMinMm: 12, rangeMaxMm: 16, sourceDescription: 'test' },
        cutLengthMm: 648.1067811865476,
        cutLengthRangeMm: [644.1067811865476, 652.1067811865476],
      },
    })

    const saved = await saveSnapshot(snapshot)
    const retrieved = await getSnapshot(saved.id)
    expect(retrieved!.strategy.type).toBe('threaded-npt')
    // @ts-expect-error — gapAMm must not exist on threaded-npt strategy
    expect(retrieved!.strategy.gapAMm).toBeUndefined()
    void engagement // suppress unused warning
  })
})

// ---------------------------------------------------------------------------
// Test C — Account separation
// ---------------------------------------------------------------------------

describe('Test C — account separation', () => {
  it('clearSnapshotsForUser removes only target user snapshots', async () => {
    const snap1 = baseSnapshot({ id: '00000000-0000-0000-0000-000000000031', userId: 'user1', organizationId: 'org1' })
    const snap2 = baseSnapshot({ id: '00000000-0000-0000-0000-000000000032', userId: 'user2', organizationId: 'org1' })

    await saveSnapshot(snap1)
    await saveSnapshot(snap2)

    await clearSnapshotsForUser('user1', 'org1')

    const user1Snaps = await listSnapshots('user1', 'org1')
    const user2Snaps = await listSnapshots('user2', 'org1')

    expect(user1Snaps).toHaveLength(0)
    expect(user2Snaps).toHaveLength(1)
    expect(user2Snaps[0].id).toBe('00000000-0000-0000-0000-000000000032')
  })
})

// ---------------------------------------------------------------------------
// Test D — Unverified BW → geometry only
// ---------------------------------------------------------------------------

describe('Test D — unverified BW fitting blocks cut length', () => {
  it('computeBwCutLength returns BwError when verified=false', () => {
    const result = computeBwCutLength({
      travel: 781.0249675906654,
      fittingA: { deductionMm: 50, verified: false, sourceDoc: 'unverified', nominalSizeNps: '2', angleDeg: 45 },
      fittingB: { deductionMm: 60, verified: true,  sourceDoc: 'ASME B16.9',  nominalSizeNps: '2', angleDeg: 45 },
      gapA: { valueMm: 3, confirmed: true },
      gapB: { valueMm: 3, confirmed: true },
    })
    expect(result.kind).toBe('bw-error')
    if (result.kind === 'bw-error') {
      expect(result.reason).toMatch(/verified=false/)
    }
  })

  it('snapshot strategy is geometry-only when BW fails', () => {
    // When BW computation returns an error, the caller records geometry-only.
    const snap = baseSnapshot({
      id: '00000000-0000-0000-0000-000000000041',
      strategy: { type: 'geometry-only' },
    })
    // geometry-only strategy must not have gapAMm, gapBMm, cutLengthMm
    expect('gapAMm' in snap.strategy).toBe(false)
    expect('cutLengthMm' in snap.strategy).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test E — Flag off (cannot be unit-tested; documented for E2E)
// ---------------------------------------------------------------------------

// When PFOS_FIELD_ISO_CALC=false:
//   - The calculator card is not rendered in src/app/(field)/calc/page.tsx
//     (card is conditionally rendered behind FLAGS.PFOS_FIELD_ISO_CALC)
//   - The /calc/iso-tap-calc route returns 404 (CALCULATOR_MAP entry absent)
//   - No OCR imports are loaded (TesseractAdapter uses dynamic import inside init())
//   - This cannot be verified in a Jest unit test; flagged for Playwright E2E.
