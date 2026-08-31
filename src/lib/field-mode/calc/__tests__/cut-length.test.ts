import { cutLengthButtWeld, cutLengthSocketWeld, cutLengthThreaded } from '../cut-length'
import { fromMm, fromInches, toMm } from '../types'
import { makeMockRefAdapter, makeRefRow } from './mock-ref-adapter'
import type { BwFittingRow } from '../reference'

function makeBwRow(overrides: Partial<BwFittingRow> = {}): BwFittingRow {
  return {
    nps: '6',
    od_in: 6.625,
    od_mm: 168.275,
    fitting_type: 'elbow_90_lr',
    dimension_label: 'A',
    center_to_end_in: 6,
    center_to_end_mm: 152.4,
    derived: false,
    standard: 'ASME B16.9',
    edition: '2018',
    ...overrides,
  }
}

describe('cutLengthButtWeld', () => {
  it('zero fittings → cut_length = center_to_center', async () => {
    const ref = makeMockRefAdapter()
    const result = await cutLengthButtWeld(
      { center_to_center: fromMm(914.4), fittings: [], assume_lr_standard: false },
      ref,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMm(result.value.cut_length)).toBeCloseTo(914.4, 6)
  })

  it('two elbows A=152.4mm on 36" C-to-C → cut = 609.6 mm', async () => {
    const ref = makeMockRefAdapter({
      getBwFitting: async () => [makeRefRow(makeBwRow())],
    })
    const result = await cutLengthButtWeld(
      {
        center_to_center: fromMm(914.4), // 36 in
        fittings: [
          { end: 'A', type: 'elbow_90_lr', nps: '6' },
          { end: 'B', type: 'elbow_90_lr', nps: '6' },
        ],
        assume_lr_standard: false,
      },
      ref,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 914.4 - 152.4 - 152.4 = 609.6
    expect(toMm(result.value.cut_length)).toBeCloseTo(609.6, 6)
    expect(result.value.take_outs.length).toBe(2)
    expect(result.value.take_outs[0].assumed).toBe(false)
  })

  it('missing fitting, assume_lr_standard=false → MissingReferenceData', async () => {
    const ref = makeMockRefAdapter({
      getBwFitting: async () => [],
    })
    const result = await cutLengthButtWeld(
      {
        center_to_center: fromMm(500),
        fittings: [{ end: 'A', type: 'elbow_90_lr', nps: '4' }],
        assume_lr_standard: false,
      },
      ref,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('MissingReferenceData')
  })

  it('missing fitting, assume_lr_standard=true → uses 1.5×OD and marks assumed', async () => {
    let callCount = 0
    const ref = makeMockRefAdapter({
      getBwFitting: async (p) => {
        callCount++
        if (p.fitting_type === 'elbow_90_lr' && callCount === 2) {
          // Second call (fallback lookup for OD)
          return [makeRefRow(makeBwRow({ center_to_end_mm: 0 }))]
        }
        if (callCount > 1) {
          // OD lookup
          return [makeRefRow(makeBwRow())]
        }
        return []
      },
    })
    const result = await cutLengthButtWeld(
      {
        center_to_center: fromMm(914.4),
        fittings: [{ end: 'A', type: 'elbow_90_sr', nps: '6' }],
        assume_lr_standard: true,
      },
      ref,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.take_outs[0].assumed).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('ADVERSARIAL 4.4-b: precision accumulation — no internal rounding', async () => {
    // Use values that would produce rounding errors if intermediate rounding occurred
    // 914.4 - 152.4 - 152.4 = 609.6 exactly — test at sub-mm precision
    const ref = makeMockRefAdapter({
      getBwFitting: async () => [makeRefRow(makeBwRow({ center_to_end_mm: 152.4 }))],
    })
    const result = await cutLengthButtWeld(
      {
        center_to_center: fromMm(914.4),
        fittings: [
          { end: 'A', type: 'elbow_90_lr', nps: '6' },
          { end: 'B', type: 'elbow_90_lr', nps: '6' },
        ],
        assume_lr_standard: false,
      },
      ref,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Must be within floating-point precision — no 1mm rounding applied
    expect(toMm(result.value.cut_length)).toBeCloseTo(609.6, 6)
  })

  it('ADVERSARIAL 4.4-c: edition flows through to adapter call', async () => {
    let receivedEdition: string | undefined
    const ref = makeMockRefAdapter({
      getBwFitting: async (p) => {
        receivedEdition = p.edition
        return [makeRefRow(makeBwRow())]
      },
    })
    await cutLengthButtWeld(
      {
        center_to_center: fromMm(500),
        fittings: [{ end: 'A', type: 'elbow_90_lr', nps: '6', edition: '2012' }],
        assume_lr_standard: false,
      },
      ref,
    )
    expect(receivedEdition).toBe('2012')
  })

  it.todo('owner-verified: NPS 3 90° LR elbows, 24" C-to-C')
  it.todo('owner-verified: NPS 6 tee + 90° LR elbow, 48" C-to-C')
  it.todo('owner-verified: NPS 2 reducer + 90° LR elbow')
  it.todo('owner-verified: NPS 8 WN flange class 150 + elbow')
  it.todo('owner-verified: NPS 4 45° LR elbows, 60" C-to-C')
})
