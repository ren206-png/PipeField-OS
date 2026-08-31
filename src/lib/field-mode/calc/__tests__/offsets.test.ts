import {
  simpleOffset,
  rollingOffset,
  parallelOffsets,
} from '../offsets'
import { fromMm, fromInches, fromDegrees, toMm, toDegrees } from '../types'

describe('simpleOffset (offset + angle)', () => {
  it('property: 45° → travel = offset × √2', () => {
    const offset = fromInches(12)
    const result = simpleOffset({ offset, angle: fromDegrees(45) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const travelMm = toMm(result.value.travel)
    const offsetMm = toMm(offset)
    expect(travelMm).toBeCloseTo(offsetMm * Math.SQRT2, 6)
  })

  it('property: 30° — run = offset × √3', () => {
    const offset = fromMm(100)
    const result = simpleOffset({ offset, angle: fromDegrees(30) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMm(result.value.run)).toBeCloseTo(100 * Math.sqrt(3), 5)
  })

  it('guard: angle=0 → InvalidInput', () => {
    const result = simpleOffset({ offset: fromMm(100), angle: fromDegrees(0) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('InvalidInput')
  })

  it('guard: angle=90 → InvalidInput', () => {
    const result = simpleOffset({ offset: fromMm(100), angle: fromDegrees(90) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('InvalidInput')
  })

  it('guard: negative offset → InvalidInput', () => {
    const result = simpleOffset({ offset: fromMm(-1), angle: fromDegrees(45) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('InvalidInput')
  })

  it.todo('owner-verified: 6" offset at 22.5° — travel and run to confirm')
  it.todo('owner-verified: 12" offset at 30° — travel and run to confirm')
  it.todo('owner-verified: 24" offset at 45° — travel and run to confirm')
  it.todo('owner-verified: 36" offset at 60° — travel and run to confirm')
  it.todo('owner-verified: 18" offset at 22.5° — travel and run to confirm')
})

describe('simpleOffset (offset + run)', () => {
  it('derives angle from offset and run', () => {
    const result = simpleOffset({ offset: fromMm(100), run: fromMm(100) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toDegrees(result.value.angle)).toBeCloseTo(45, 5)
    expect(toMm(result.value.travel)).toBeCloseTo(100 * Math.SQRT2, 5)
  })

  it('guard: run=0 → InvalidInput', () => {
    const result = simpleOffset({ offset: fromMm(100), run: fromMm(0) })
    expect(result.ok).toBe(false)
  })
})

describe('rollingOffset', () => {
  it('property: roll=0 equals simple offset', () => {
    const offset = fromInches(12)
    const angle = fromDegrees(45)

    const rolling = rollingOffset({ rise: offset, roll: fromMm(0), angle })
    const simple = simpleOffset({ offset, angle })

    expect(rolling.ok).toBe(true)
    expect(simple.ok).toBe(true)
    if (!rolling.ok || !simple.ok) return

    expect(toMm(rolling.value.true_offset)).toBeCloseTo(toMm(offset), 6)
    expect(toMm(rolling.value.travel)).toBeCloseTo(toMm(simple.value.travel), 6)
    expect(toMm(rolling.value.run)).toBeCloseTo(toMm(simple.value.run), 6)
  })

  it('computes rotation angle correctly', () => {
    const result = rollingOffset({
      rise: fromMm(100),
      roll: fromMm(100),
      angle: fromDegrees(45),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toDegrees(result.value.rotation)).toBeCloseTo(45, 5)
  })

  it('computes true offset via Pythagorean theorem', () => {
    const result = rollingOffset({
      rise: fromMm(30),
      roll: fromMm(40),
      angle: fromDegrees(45),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMm(result.value.true_offset)).toBeCloseTo(50, 5)
  })

  it('guard: angle=0 → InvalidInput', () => {
    const result = rollingOffset({ rise: fromMm(100), roll: fromMm(50), angle: fromDegrees(0) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('InvalidInput')
  })

  it.todo('owner-verified: rise=6", roll=6", angle=45° — true_offset, travel, run')
  it.todo('owner-verified: rise=12", roll=6", angle=30°')
  it.todo('owner-verified: rise=8", roll=6", angle=22.5°')
  it.todo('owner-verified: rise=9", roll=12", angle=45°')
  it.todo('owner-verified: rise=18", roll=0, angle=45° must match simple offset 18" @45°')
})

describe('parallelOffsets', () => {
  it('rejects < 2 lines', () => {
    const result = parallelOffsets({
      lines: [{
        od_mm: 60.3,
        insulation_mm: 0,
        offset: fromInches(6),
        angle: fromDegrees(45),
      }],
    })
    expect(result.ok).toBe(false)
  })

  it('2 lines returns 2 results', () => {
    const result = parallelOffsets({
      lines: [
        { od_mm: 60.3, insulation_mm: 0, offset: fromInches(6), angle: fromDegrees(45) },
        { od_mm: 88.9, insulation_mm: 0, offset: fromInches(6), angle: fromDegrees(45) },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.lines.length).toBe(2)
  })
})
