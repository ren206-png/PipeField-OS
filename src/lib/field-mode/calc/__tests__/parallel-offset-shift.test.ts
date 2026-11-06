import { parallelOffsetShiftMm, parallelOffsets } from '../offsets'
import { fromMm, toMm, fromDegrees } from '../types'

const IN = 25.4

describe('parallelOffsetShiftMm = spacing × tan(θ/2)', () => {
  test.each([
    [45, 4.9706],   // 12" × tan 22.5°
    [22.5, 2.3869], // 12" × tan 11.25°
    [11.25, 1.1821],
    [60, 6.9282],   // 12" × tan 30°
    [90, 12],       // 12" × tan 45°
  ])('12" spacing at %s° → %s"', (deg, expected) => {
    expect(parallelOffsetShiftMm(12 * IN, deg) / IN).toBeCloseTo(expected, 3)
  })
  test('not spacing / sin θ (old formula gave 16.97" for 12" at 45°)', () => {
    expect(parallelOffsetShiftMm(12 * IN, 45) / IN).not.toBeCloseTo(16.97, 1)
  })
  test.each([[0, 45], [-5, 45], [100, 0], [100, 180]])('rejects spacing %s / angle %s', (s, a) => {
    expect(() => parallelOffsetShiftMm(s, a)).toThrow(RangeError)
  })
})

describe('parallelOffsets — travel_adjustment per line', () => {
  test('line 0 has no shift; each next line shifts by c-c spacing × tan(θ/2)', () => {
    const line = { od_mm: 4.5 * IN, insulation_mm: 0, offset: fromMm(24 * IN), angle: fromDegrees(45) }
    // c-c = OD/2 + OD/2 + 1" clearance = 5.5"
    const res = parallelOffsets({ lines: [line, line, line], spacing_requirement_mm: 1 * IN })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const adj = res.value.lines.map(l => toMm(l.travel_adjustment) / IN)
    expect(adj[0]).toBeCloseTo(0, 6)
    expect(adj[1]).toBeCloseTo(5.5 * Math.tan(Math.PI / 8), 6)
    expect(adj[2]).toBeCloseTo(11 * Math.tan(Math.PI / 8), 6)
    // travel identical for every line
    const t0 = toMm(res.value.lines[0].travel)
    res.value.lines.forEach(l => expect(toMm(l.travel)).toBeCloseTo(t0, 6))
  })
})
