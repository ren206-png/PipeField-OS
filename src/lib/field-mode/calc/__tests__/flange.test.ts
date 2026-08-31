import { twoHoleFlange } from '../flange'
import { makeMockRefAdapter, makeRefRow } from './mock-ref-adapter'
import type { FlangeRow } from '../reference'

function makeFlangeRow(overrides: Partial<FlangeRow> = {}): FlangeRow {
  return {
    nps: '4',
    flange_class: 150,
    od_in: 9,
    od_mm: 228.6,
    thickness_in: 0.94,
    bolt_circle_in: 7.5,
    bolt_circle_mm: 190.5,
    bolt_count: 8,
    bolt_size_in: '5/8',
    bolt_hole_in: 0.75,
    rf_dia_in: 5,
    lth_wn_in: 1.88,
    lth_wn_mm: 47.75,
    standard: 'ASME B16.5',
    edition: '2017',
    ...overrides,
  }
}

describe('twoHoleFlange', () => {
  it('achievable rotation is always multiple of bolt_spacing/2', async () => {
    const ref = makeMockRefAdapter({
      getFlange: async () => [makeRefRow(makeFlangeRow({ bolt_count: 8 }))],
    })
    for (const target of [0, 10, 22.5, 23, 45, 90, 37]) {
      const result = await twoHoleFlange({ nps: '4', flange_class: 150, target_rotation_deg: target }, ref)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      const halfSpacing = 360 / 8 / 2 // 22.5
      const achievable = result.value.actual_rotation_achievable_deg
      // achievable must be a multiple of halfSpacing
      expect(Math.round(achievable / halfSpacing) * halfSpacing).toBeCloseTo(achievable, 6)
    }
  })

  it('4-bolt flange: bolt_spacing=90°, achievable rotations are multiples of 45°', async () => {
    const ref = makeMockRefAdapter({
      getFlange: async () => [makeRefRow(makeFlangeRow({ bolt_count: 4 }))],
    })
    for (const target of [0, 10, 22, 45, 46, 90]) {
      const result = await twoHoleFlange({ nps: '4', flange_class: 150, target_rotation_deg: target }, ref)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      const achievable = result.value.actual_rotation_achievable_deg
      expect(Math.round(achievable / 45) * 45).toBeCloseTo(achievable, 6)
    }
  })

  it('returns correct bolt spacing for 8-bolt flange', async () => {
    const ref = makeMockRefAdapter({
      getFlange: async () => [makeRefRow(makeFlangeRow({ bolt_count: 8 }))],
    })
    const result = await twoHoleFlange({ nps: '4', flange_class: 150, target_rotation_deg: 0 }, ref)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.bolt_spacing_deg).toBeCloseTo(45, 6)
  })

  it('missing flange → MissingReferenceData', async () => {
    const ref = makeMockRefAdapter()
    const result = await twoHoleFlange({ nps: '4', flange_class: 150, target_rotation_deg: 22.5 }, ref)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('MissingReferenceData')
  })

  it.todo('owner-verified: NPS 4 class 150, target 30° — achievable and hole_offset')
  it.todo('owner-verified: NPS 6 class 300, target 22.5°')
  it.todo('owner-verified: NPS 8 class 150, target 45°')
  it.todo('owner-verified: NPS 2 class 600, target 15°')
  it.todo('owner-verified: NPS 12 class 150, target 0° (aligned)')
})
