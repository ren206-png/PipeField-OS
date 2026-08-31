import { branchLayout } from '../branch'
import { fromMm, toMm } from '../types'

describe('branchLayout (90° perpendicular branch)', () => {
  const header = fromMm(219.075) // 8-5/8" OD (8" pipe)
  const branch = fromMm(114.3)   // 4-1/2" OD (4" pipe)

  it('ordinate at φ=0° → 0', () => {
    const result = branchLayout({
      header_od: header,
      branch_od: branch,
      branch_angle_deg: 90,
      ordinate_count: 12,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const phi0 = result.value.ordinates.find(o => o.station_deg === 0)
    expect(phi0).toBeDefined()
    expect(toMm(phi0!.ordinate)).toBeCloseTo(0, 6)
  })

  it('ordinate at φ=90° → header_od/2 (= r_header)', () => {
    const result = branchLayout({
      header_od: header,
      branch_od: branch,
      branch_angle_deg: 90,
      ordinate_count: 12,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // At 90°, ordinate = r_header × (1 - cos(90°)) = r_header × 1 = r_header
    const phi90 = result.value.ordinates.find(o => Math.abs(o.station_deg - 90) < 0.001)
    const rHeader = toMm(header) / 2
    expect(toMm(phi90!.ordinate)).toBeCloseTo(rHeader, 4)
  })

  it('ordinate at φ=180° → header_od (max = 2 × r_header)', () => {
    const result = branchLayout({
      header_od: header,
      branch_od: branch,
      branch_angle_deg: 90,
      ordinate_count: 12,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const phi180 = result.value.ordinates.find(o => Math.abs(o.station_deg - 180) < 0.001)
    const headerOdMm = toMm(header)
    expect(toMm(phi180!.ordinate)).toBeCloseTo(headerOdMm, 4)
  })

  it('symmetric: ordinate(φ) = ordinate(360-φ)', () => {
    const result = branchLayout({
      header_od: header,
      branch_od: branch,
      branch_angle_deg: 90,
      ordinate_count: 12,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ords = result.value.ordinates
    for (const o of ords) {
      if (o.station_deg === 0 || o.station_deg === 360) continue
      const mirror = ords.find(x => Math.abs(x.station_deg - (360 - o.station_deg)) < 0.001)
      if (mirror) {
        expect(toMm(o.ordinate)).toBeCloseTo(toMm(mirror.ordinate), 4)
      }
    }
  })

  it('rejects branch_od > header_od', () => {
    const result = branchLayout({
      header_od: fromMm(100),
      branch_od: fromMm(200),
      branch_angle_deg: 90,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('InvalidInput')
  })

  it('rejects branch_angle <= 0', () => {
    const result = branchLayout({
      header_od: header,
      branch_od: branch,
      branch_angle_deg: 0,
    })
    expect(result.ok).toBe(false)
  })

  it.todo('owner-verified: 8" header, 4" branch, 90° — ordinate at each 30° station')
  it.todo('owner-verified: 12" header, 6" branch, 90°')
  it.todo('owner-verified: 6" header, 4" branch, 90°')
  it.todo('owner-verified: 10" header, 6" branch, 45° lateral — note owner-verify flag expected')
  it.todo('owner-verified: 4" header, 2" branch, 90°')
})
