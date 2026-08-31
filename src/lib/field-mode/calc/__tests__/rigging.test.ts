import {
  slingLegTension,
  snatchBlockLoad,
  shackleSWL,
  wireRopeSWL,
  syntheticSlingWLL,
  chainSlingWLL,
} from '../rigging'
import { makeMockRefAdapter, makeRefRow } from './mock-ref-adapter'

describe('rigging — unverified row refusal', () => {
  it('ADVERSARIAL 4.4-d: verified=false → UnverifiedReferenceData (any recall_confidence)', async () => {
    const ref = makeMockRefAdapter({
      getSlingLegFactor: async () => [
        makeRefRow(
          { angle_from_horizontal_deg: 60, angle_from_vertical_deg: 30, leg_load_multiplier: 1.155, note: null },
          { verified: false, recall_confidence: 'low' }, // verified=false, low confidence
        ),
      ],
    })
    const result = await slingLegTension(
      { load_kg: 1000, angle_from_horizontal_deg: 60, num_legs: 2 },
      ref,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('UnverifiedReferenceData')
  })

  it('verified=true with LOW confidence IS allowed to compute', async () => {
    const ref = makeMockRefAdapter({
      getSlingLegFactor: async () => [
        makeRefRow(
          { angle_from_horizontal_deg: 60, angle_from_vertical_deg: 30, leg_load_multiplier: 1.155, note: null },
          { verified: true, recall_confidence: 'low' }, // verified=true even though low confidence
        ),
      ],
    })
    const result = await slingLegTension(
      { load_kg: 1000, angle_from_horizontal_deg: 60, num_legs: 2 },
      ref,
    )
    expect(result.ok).toBe(true)
  })
})

describe('shackleSWL', () => {
  it('applied_load > swl_kg → ExceedsSWL', async () => {
    const ref = makeMockRefAdapter({
      getShackle: async () => [
        makeRefRow({
          bow_size_in: '3/4',
          bow_dia_in: 0.75,
          bow_dia_mm: 19.05,
          wll_short_tons: 2,
          wll_kg: 1814,
          inside_width_at_pin_in: null,
          inside_width_at_pin_mm: null,
          pin_dia_in: null,
          pin_dia_mm: null,
          inside_length_in: null,
          inside_length_mm: null,
          standard: null,
          edition: null,
        }),
      ],
    })
    const result = await shackleSWL({ bow_size_in: '3/4', applied_load_kg: 2000 }, ref)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('ExceedsSWL')
  })

  it('applied_load <= swl_kg → ok result', async () => {
    const ref = makeMockRefAdapter({
      getShackle: async () => [
        makeRefRow({
          bow_size_in: '3/4',
          bow_dia_in: 0.75,
          bow_dia_mm: 19.05,
          wll_short_tons: 2,
          wll_kg: 1814,
          inside_width_at_pin_in: null,
          inside_width_at_pin_mm: null,
          pin_dia_in: null,
          pin_dia_mm: null,
          inside_length_in: null,
          inside_length_mm: null,
          standard: null,
          edition: null,
        }),
      ],
    })
    const result = await shackleSWL({ bow_size_in: '3/4', applied_load_kg: 1000 }, ref)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.swl_kg).toBeCloseTo(1814, 0)
  })
})

describe('slingLegTension', () => {
  it('computes leg tension correctly', async () => {
    const ref = makeMockRefAdapter({
      getSlingLegFactor: async () => [
        makeRefRow({
          angle_from_horizontal_deg: 60,
          angle_from_vertical_deg: 30,
          leg_load_multiplier: 1.155,
          note: null,
          standard: null,
          edition: null,
        }),
      ],
    })
    const result = await slingLegTension({ load_kg: 1000, angle_from_horizontal_deg: 60, num_legs: 2 }, ref)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 1000 × 1.155 / 2 = 577.5
    expect(result.value.leg_tension_kg).toBeCloseTo(577.5, 2)
  })

  it('missing factor → MissingReferenceData', async () => {
    const ref = makeMockRefAdapter()
    const result = await slingLegTension({ load_kg: 1000, angle_from_horizontal_deg: 60, num_legs: 2 }, ref)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('MissingReferenceData')
  })

  it.todo('owner-verified: 5000kg load, 2 legs, 60° from horizontal')
  it.todo('owner-verified: 2000kg load, 4 legs, 45° from horizontal')
  it.todo('owner-verified: 800kg load, 1 leg vertical (90° from horizontal)')
  it.todo('owner-verified: 3000kg load, 2 legs, 30° from horizontal')
  it.todo('owner-verified: 10000kg load, 4 legs, 60° from horizontal')
})
