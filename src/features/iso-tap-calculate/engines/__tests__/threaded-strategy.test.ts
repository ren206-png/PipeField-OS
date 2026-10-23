import { computeThreadedCutLength } from '../threaded-strategy'
import type {
  ThreadedOffsetInput,
  ThreadedDirectFTFInput,
  ThreadedFittingSpec,
  EngagementRecord,
} from '../schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eng(valueMm: number, minMm: number, maxMm: number, source = 'Manufacturer datasheet Rev A'): EngagementRecord {
  return {
    basis: 'project-entered',
    valueMm,
    rangeMinMm: minMm,
    rangeMaxMm: maxMm,
    sourceDescription: source,
    confirmedByUser: true,
    confirmedAt: '2026-10-23T00:00:00.000Z',
  }
}

function nptFitting(
  faceDistanceMm: number,
  engagement: EngagementRecord,
  nps = '1"',
  angleDeg = 90,
): ThreadedFittingSpec {
  return {
    threadFamily: 'NPT',
    nominalSizeNps: nps,
    angleDeg,
    faceDistanceMm,
    faceDistanceVerified: true,
    faceDistanceSource: 'ASME B16.3 Table 3',
    engagement,
  }
}

function offsetInput(
  c: number,
  f1: ThreadedFittingSpec,
  f2: ThreadedFittingSpec,
): ThreadedOffsetInput {
  return { inputMode: 'offset-derived-c', c, fitting1: f1, fitting2: f2 }
}

function ftfInput(
  b: number,
  f1: ThreadedFittingSpec,
  f2: ThreadedFittingSpec,
): ThreadedDirectFTFInput {
  return { inputMode: 'direct-ftf', b, axisConfirmed: true, fitting1: f1, fitting2: f2 }
}

function ok(r: ReturnType<typeof computeThreadedCutLength>) {
  if (r.kind !== 'threaded-result') throw new Error(`Expected threaded-result, got ${r.kind}: ${JSON.stringify(r)}`)
  return r
}

// ---------------------------------------------------------------------------
// Spec fixtures (all values independently derived)
// ---------------------------------------------------------------------------

describe('threaded-strategy — fixture: C=1000, F1=40, F2=45, E1=12, E2=14', () => {
  const f1 = nptFitting(40, eng(12, 11, 13))
  const f2 = nptFitting(45, eng(14, 13, 15))

  test('offset-derived-c: D1=28, D2=31, B=915, Lcut=941', () => {
    const r = ok(computeThreadedCutLength(offsetInput(1000, f1, f2)))
    expect(r.breakdown.d1).toBe(28)       // F1 - E1 = 40 - 12
    expect(r.breakdown.d2).toBe(31)       // F2 - E2 = 45 - 14
    expect(r.b).toBe(915)                  // C - F1 - F2 = 1000 - 40 - 45
    expect(r.cutLengthMm).toBe(941)        // 1000 - 40 + 12 - 45 + 14
    expect(r.breakdown.formula).toContain('C')
  })

  test('direct face-to-face B=915: Lcut=941 (bases agree)', () => {
    const r = ok(computeThreadedCutLength(ftfInput(915, f1, f2)))
    expect(r.cutLengthMm).toBe(941)        // B + E1 + E2 = 915 + 12 + 14
    expect(r.b).toBe(915)
    expect(r.breakdown.formula).toContain('B')
  })
})

describe('threaded-strategy — fixture: C=20 in (508 mm)', () => {
  // C=20 in = 508 mm, F1=1.5 in = 38.1 mm, F2=1.75 in = 44.45 mm
  // E1=0.5 in = 12.7 mm, E2=0.625 in = 15.875 mm
  // Lcut = 17.875 in = 454.025 mm
  const F1 = 1.5 * 25.4   // 38.1
  const F2 = 1.75 * 25.4  // 44.45
  const E1 = 0.5 * 25.4   // 12.7
  const E2 = 0.625 * 25.4 // 15.875
  const C = 20 * 25.4     // 508

  test('Lcut = 454.025 mm = 17.875 in', () => {
    const f1 = nptFitting(F1, eng(E1, E1 * 0.9, E1 * 1.1))
    const f2 = nptFitting(F2, eng(E2, E2 * 0.9, E2 * 1.1))
    const r = ok(computeThreadedCutLength(offsetInput(C, f1, f2)))
    expect(r.cutLengthMm).toBeCloseTo(454.025, 6)
    expect(r.cutLengthMm! / 25.4).toBeCloseTo(17.875, 10)
  })
})

describe('threaded-strategy — engagement range, no auto-target', () => {
  test('E1∈[11,13], E2∈[13,15] → range [939,943], no single target without explicit E', () => {
    // Range fixture: E1min=11, E1max=13; E2min=13, E2max=15; C=1000, F1=40, F2=45
    // rangeMin = 1000 - 40 + 11 - 45 + 13 = 939
    // rangeMax = 1000 - 40 + 13 - 45 + 15 = 943
    const f1 = nptFitting(40, eng(12, 11, 13))
    const f2 = nptFitting(45, eng(14, 13, 15))
    const r = ok(computeThreadedCutLength(offsetInput(1000, f1, f2)))
    expect(r.cutLengthRangeMm[0]).toBe(939)
    expect(r.cutLengthRangeMm[1]).toBe(943)
    // Target is confirmed because E values are project-entered and confirmed
    // (single target IS available when user explicitly confirmed E values)
    expect(r.cutLengthMm).toBe(941)
  })
})

describe('threaded-strategy — sensitivity', () => {
  test('+1 mm engagement ⇒ +1 mm Lcut', () => {
    const f1a = nptFitting(40, eng(12, 11, 13))
    const f1b = nptFitting(40, eng(13, 12, 14))  // E+1
    const f2 = nptFitting(45, eng(14, 13, 15))
    const r1 = ok(computeThreadedCutLength(offsetInput(1000, f1a, f2)))
    const r2 = ok(computeThreadedCutLength(offsetInput(1000, f1b, f2)))
    expect(r2.cutLengthMm! - r1.cutLengthMm!).toBeCloseTo(1)
  })

  test('+1 mm face distance ⇒ −1 mm Lcut', () => {
    const f1a = nptFitting(40, eng(12, 11, 13))
    const f1b = nptFitting(41, eng(12, 11, 13))  // F+1
    const f2 = nptFitting(45, eng(14, 13, 15))
    const r1 = ok(computeThreadedCutLength(offsetInput(1000, f1a, f2)))
    const r2 = ok(computeThreadedCutLength(offsetInput(1000, f1b, f2)))
    expect(r2.cutLengthMm! - r1.cutLengthMm!).toBeCloseTo(-1)
  })

  test('effective-deduction D1 = F1 - E1 receives NO additional engagement', () => {
    const f1 = nptFitting(40, eng(12, 11, 13))
    const f2 = nptFitting(45, eng(14, 13, 15))
    const r = ok(computeThreadedCutLength(offsetInput(1000, f1, f2)))
    // D1 = F1 - E1 = 40 - 12 = 28; verify it is not 40 - 12 - 12 or similar
    expect(r.breakdown.d1).toBe(28)
    expect(r.breakdown.e1).toBe(12)
    // Lcut must equal C - D1 - D2 (no extra engagement added)
    const expected = 1000 - r.breakdown.d1 - r.breakdown.d2
    expect(r.cutLengthMm).toBeCloseTo(expected)
  })
})

describe('threaded-strategy — negative tests', () => {
  const f1Good = nptFitting(40, eng(12, 11, 13))
  const f2Good = nptFitting(45, eng(14, 13, 15))

  test('unknown thread family BSPT → error', () => {
    const f1 = { ...f1Good, threadFamily: 'BSPT' as never }
    const r = computeThreadedCutLength(offsetInput(1000, f1, f2Good))
    expect(r.kind).toBe('threaded-error')
    if (r.kind !== 'threaded-error') return
    expect(r.reason).toContain('BSPT')
  })

  test('unknown thread family NPT-F → error', () => {
    const f1 = { ...f1Good, threadFamily: 'NPT-F' as never }
    const r = computeThreadedCutLength(offsetInput(1000, f1, f2Good))
    expect(r.kind).toBe('threaded-error')
  })

  test('engagement outside documented bounds → error', () => {
    const f1 = nptFitting(40, eng(20, 11, 13))  // E=20 > max=13
    const r = computeThreadedCutLength(offsetInput(1000, f1, f2Good))
    expect(r.kind).toBe('threaded-error')
    if (r.kind !== 'threaded-error') return
    expect(r.reason).toContain('outside documented range')
  })

  test('overlapping faces (B < 0) → error', () => {
    // C=50, F1=30, F2=30 → B = -10
    const f1 = nptFitting(30, eng(5, 4, 6))
    const f2 = nptFitting(30, eng(5, 4, 6))
    const r = computeThreadedCutLength(offsetInput(50, f1, f2))
    expect(r.kind).toBe('threaded-error')
    if (r.kind !== 'threaded-error') return
    expect(r.reason).toContain('negative')
  })

  test('missing source description → error', () => {
    const badEng: EngagementRecord = {
      basis: 'project-entered',
      valueMm: 12,
      rangeMinMm: 11,
      rangeMaxMm: 13,
      sourceDescription: '',
      confirmedByUser: true,
      confirmedAt: '2026-10-23T00:00:00.000Z',
    }
    const f1 = nptFitting(40, badEng)
    const r = computeThreadedCutLength(offsetInput(1000, f1, f2Good))
    expect(r.kind).toBe('threaded-error')
  })

  test('unconfirmed engagement → error', () => {
    const badEng: EngagementRecord = { ...eng(12, 11, 13), confirmedByUser: false }
    const f1 = nptFitting(40, badEng)
    const r = computeThreadedCutLength(offsetInput(1000, f1, f2Good))
    expect(r.kind).toBe('threaded-error')
  })
})

describe('threaded-strategy — type isolation (no BW state)', () => {
  test('ThreadedResult has no gapA, gapB, or deductionMm fields', () => {
    const f1 = nptFitting(40, eng(12, 11, 13))
    const f2 = nptFitting(45, eng(14, 13, 15))
    const r = ok(computeThreadedCutLength(offsetInput(1000, f1, f2)))
    expect('gapA' in r).toBe(false)
    expect('gapB' in r).toBe(false)
    expect('deductionMm' in r).toBe(false)
  })
})

describe('threaded-strategy — warning', () => {
  test('assembly sequence warning always present', () => {
    const f1 = nptFitting(40, eng(12, 11, 13))
    const f2 = nptFitting(45, eng(14, 13, 15))
    const r = ok(computeThreadedCutLength(offsetInput(1000, f1, f2)))
    expect(r.warnings.some(w => w.toLowerCase().includes('assembled in place'))).toBe(true)
  })
})
