import { computeBwCutLength } from '../bw-strategy'
import type { BwInput } from '../schemas'

function verifiedFitting(deductionMm: number): BwInput['fittingA'] {
  return {
    deductionMm,
    verified: true,
    sourceDoc: 'ASME B16.9 Table 1',
    nominalSizeNps: '4"',
    angleDeg: 45,
  }
}

function confirmedGap(valueMm: number): BwInput['gapA'] {
  return { valueMm, confirmed: true }
}

describe('bw-strategy — fixture', () => {
  test('T=1000, A1=100, A2=120, g1=g2=3 → Lcut=774 mm', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(120),
      gapA: confirmedGap(3),
      gapB: confirmedGap(3),
    })
    expect(r.kind).toBe('bw-result')
    if (r.kind !== 'bw-result') return
    expect(r.cutLengthMm).toBe(774)
    expect(r.breakdown.travel).toBe(1000)
    expect(r.breakdown.deductionA).toBe(100)
    expect(r.breakdown.deductionB).toBe(120)
    expect(r.breakdown.gapA).toBe(3)
    expect(r.breakdown.gapB).toBe(3)
  })

  test('zero gap must be explicitly confirmed', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(100),
      gapA: confirmedGap(0),
      gapB: confirmedGap(0),
    })
    expect(r.kind).toBe('bw-result')
    if (r.kind !== 'bw-result') return
    expect(r.cutLengthMm).toBe(800)
  })
})

describe('bw-strategy — validation', () => {
  test('unverified fitting A → error', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: { ...verifiedFitting(100), verified: false },
      fittingB: verifiedFitting(120),
      gapA: confirmedGap(3),
      gapB: confirmedGap(3),
    })
    expect(r.kind).toBe('bw-error')
  })

  test('unverified fitting B → error', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: verifiedFitting(100),
      fittingB: { ...verifiedFitting(120), verified: false },
      gapA: confirmedGap(3),
      gapB: confirmedGap(3),
    })
    expect(r.kind).toBe('bw-error')
  })

  test('unconfirmed gap A → error', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(120),
      gapA: { valueMm: 3, confirmed: false },
      gapB: confirmedGap(3),
    })
    expect(r.kind).toBe('bw-error')
  })

  test('unconfirmed gap B → error', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(120),
      gapA: confirmedGap(3),
      gapB: { valueMm: 3, confirmed: false },
    })
    expect(r.kind).toBe('bw-error')
  })

  test('travel ≤ 0 → error', () => {
    const r = computeBwCutLength({
      travel: 0,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(120),
      gapA: confirmedGap(3),
      gapB: confirmedGap(3),
    })
    expect(r.kind).toBe('bw-error')
  })

  test('negative cut length → error with explanation', () => {
    const r = computeBwCutLength({
      travel: 100,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(100),
      gapA: confirmedGap(3),
      gapB: confirmedGap(3),
    })
    expect(r.kind).toBe('bw-error')
    if (r.kind !== 'bw-error') return
    expect(r.reason).toContain('-106')
  })
})

describe('bw-strategy — type isolation (no threaded state)', () => {
  test('BwResult has no gap or threaded fields', () => {
    const r = computeBwCutLength({
      travel: 1000,
      fittingA: verifiedFitting(100),
      fittingB: verifiedFitting(120),
      gapA: confirmedGap(3),
      gapB: confirmedGap(3),
    })
    if (r.kind !== 'bw-result') return
    // TypeScript guarantees, confirmed at runtime too
    expect('cutLengthRangeMm' in r).toBe(false)
    expect('b' in r).toBe(false)
    expect('fitting1' in r).toBe(false)
  })
})
