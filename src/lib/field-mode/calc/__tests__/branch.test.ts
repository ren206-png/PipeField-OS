import { branchLayout } from '../branch'
import { fromMm, toMm } from '../types'

const IN = 25.4
const ord = (res: ReturnType<typeof branchLayout>, deg: number) => {
  if (!res.ok) throw new Error('expected ok')
  const o = res.value.ordinates.find(x => Math.abs(x.station_deg - deg) < 1e-9)
  if (!o) throw new Error(`no station ${deg}`)
  return toMm(o.ordinate)
}

describe('branchLayout — 90° branch (fishmouth)', () => {
  // 8" header (8.625" OD), 4" branch (4.5" OD)
  const R = 8.625 * IN / 2
  const r = 4.5 * IN / 2
  const res = branchLayout({ header_od: fromMm(2 * R), branch_od: fromMm(2 * r), branch_angle_deg: 90, ordinate_count: 12 })

  it('is 0 where the branch is longest (stations 0° and 180°)', () => {
    expect(ord(res, 0)).toBeCloseTo(0, 6)
    expect(ord(res, 180)).toBeCloseTo(0, 6)
  })
  it('deepest cut at the sides = R − √(R² − r²)', () => {
    const expected = R - Math.sqrt(R * R - r * r)
    expect(ord(res, 90)).toBeCloseTo(expected, 6)
    expect(ord(res, 270)).toBeCloseTo(expected, 6)
    if (res.ok) expect(toMm(res.value.max_ordinate)).toBeCloseTo(expected, 6)
  })
  it('matches R − √(R² − r²·sin²φ) at every station', () => {
    for (let i = 0; i <= 12; i++) {
      const phi = (i * 30 * Math.PI) / 180
      expect(ord(res, i * 30)).toBeCloseTo(R - Math.sqrt(R * R - r * r * Math.sin(phi) ** 2), 6)
    }
  })
  it('8" × 4" at 90°: deepest cut ≈ 0.6335"', () => {
    expect(ord(res, 90) / IN).toBeCloseTo(0.6335, 3)
  })
  it('is symmetric: ordinate(φ) = ordinate(360 − φ) and ordinate(180 − φ)', () => {
    for (const d of [30, 60, 120, 150]) {
      expect(ord(res, d)).toBeCloseTo(ord(res, 360 - d), 6)
      expect(ord(res, d)).toBeCloseTo(ord(res, 180 - d), 6)
    }
  })
  it('stations are equal divisions with arc = π·OD·i/n', () => {
    if (!res.ok) return
    const circ = Math.PI * 2 * r
    res.value.ordinates.forEach((o, i) => {
      expect(o.station_deg).toBeCloseTo((i * 360) / 12, 9)
      expect(toMm(o.arc)).toBeCloseTo((circ * i) / 12, 6)
    })
  })
})

describe('branchLayout — equal size tee (size-on-size)', () => {
  it('deepest cut = header radius', () => {
    const od = 4.5 * IN
    const res = branchLayout({ header_od: fromMm(od), branch_od: fromMm(od), branch_angle_deg: 90, ordinate_count: 4 })
    expect(ord(res, 90)).toBeCloseTo(od / 2, 6)
    expect(ord(res, 0)).toBeCloseTo(0, 6)
  })
})

describe('branchLayout — 45° lateral', () => {
  const R = 10.75 * IN / 2 // 10" header
  const r = 6.625 * IN / 2 // 6" branch
  const res = branchLayout({ header_od: fromMm(2 * R), branch_od: fromMm(2 * r), branch_angle_deg: 45, ordinate_count: 16 })
  const t = (phi: number) => (Math.sqrt(R * R - r * r * Math.sin(phi) ** 2) - r * Math.cos(phi) * Math.cos(Math.PI / 4)) / Math.sin(Math.PI / 4)

  it('heel (180°) is the longest point, toe (0°) is cut back the most', () => {
    expect(ord(res, 180)).toBeCloseTo(0, 6)
    if (res.ok) expect(toMm(res.value.max_ordinate)).toBeCloseTo(ord(res, 0), 6)
  })
  it('heel-to-toe cut-back = 2·r·cot θ for θ = 45°', () => {
    // t(180°) − t(0°) = 2 r cosθ / sinθ
    expect(ord(res, 0)).toBeCloseTo(2 * r / Math.tan(Math.PI / 4), 6)
  })
  it('matches t_max − t(φ) at every station', () => {
    const tMax = t(Math.PI)
    for (let i = 0; i <= 16; i++) {
      const phi = (i * 22.5 * Math.PI) / 180
      expect(ord(res, i * 22.5)).toBeCloseTo(tMax - t(phi), 4)
    }
  })
  it('symmetric about the heel–toe line', () => {
    expect(ord(res, 90)).toBeCloseTo(ord(res, 270), 6)
    expect(ord(res, 45)).toBeCloseTo(ord(res, 315), 6)
  })
  it('at 90° the lateral formula reduces to the fishmouth', () => {
    const a = branchLayout({ header_od: fromMm(2 * R), branch_od: fromMm(2 * r), branch_angle_deg: 90, ordinate_count: 16 })
    for (let i = 0; i <= 16; i++) {
      const phi = (i * 22.5 * Math.PI) / 180
      expect(ord(a, i * 22.5)).toBeCloseTo(R - Math.sqrt(R * R - r * r * Math.sin(phi) ** 2), 4)
    }
  })
})

describe('branchLayout — input checks', () => {
  const h = fromMm(219.075), b = fromMm(114.3)
  it('rejects branch OD > header OD', () => {
    const res = branchLayout({ header_od: fromMm(100), branch_od: fromMm(200), branch_angle_deg: 90 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.kind).toBe('InvalidInput')
  })
  it.each([0, 180, -10, 200])('rejects angle %s', a => {
    expect(branchLayout({ header_od: h, branch_od: b, branch_angle_deg: a }).ok).toBe(false)
  })
  it('rejects zero ODs and bad station counts', () => {
    expect(branchLayout({ header_od: fromMm(0), branch_od: b, branch_angle_deg: 90 }).ok).toBe(false)
    expect(branchLayout({ header_od: h, branch_od: b, branch_angle_deg: 90, ordinate_count: 3 }).ok).toBe(false)
    expect(branchLayout({ header_od: h, branch_od: b, branch_angle_deg: 90, ordinate_count: 7.5 }).ok).toBe(false)
  })
  it('default is 16 equal stations', () => {
    const res = branchLayout({ header_od: h, branch_od: b, branch_angle_deg: 90 })
    if (res.ok) expect(res.value.ordinates).toHaveLength(17)
  })
})
