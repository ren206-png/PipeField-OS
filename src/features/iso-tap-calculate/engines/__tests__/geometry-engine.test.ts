import { computeModeA, computeModeB, checkFittingAngle } from '../geometry-engine'
import type { ModeAInput, ModeBInput, ConfirmedMeasurement } from '../schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mm(valueMm: number): ConfirmedMeasurement {
  return {
    kind: 'measurement',
    rawText: `${valueMm}mm`,
    normalizedText: `${valueMm}mm`,
    originalUnit: 'mm',
    valueMm,
    valueIn: valueMm / 25.4,
    sourceType: 'manual',
    confirmed: true,
  }
}

function modeAInput(riseMm: number, rollMm: number, runMm: number): ModeAInput {
  return { rise: mm(riseMm), roll: mm(rollMm), run: mm(runMm) }
}

function modeBInput(riseMm: number, rollMm: number, angleDeg: number): ModeBInput {
  return { rise: mm(riseMm), roll: mm(rollMm), angleDeg }
}

function modeAOk(r: ReturnType<typeof computeModeA>) {
  if (r.kind !== 'mode-a') throw new Error(`Expected mode-a, got ${r.kind}: ${JSON.stringify(r)}`)
  return r
}

function modeBOk(r: ReturnType<typeof computeModeB>) {
  if (r.kind !== 'mode-b') throw new Error(`Expected mode-b, got ${r.kind}: ${JSON.stringify(r)}`)
  return r
}

// ---------------------------------------------------------------------------
// Mode B spec fixtures
// (All expected values are independently derived — NOT from running the implementation)
// ---------------------------------------------------------------------------

describe('geometry-engine — Mode B fixtures', () => {
  test('V=300, H=400, θ=45° → O=500, U=500, T=707.1067811865476', () => {
    const r = modeBOk(computeModeB(modeBInput(300, 400, 45)))
    expect(r.trueOffset).toBeCloseTo(500, 10)
    expect(r.run).toBeCloseTo(500, 10)
    expect(r.travel).toBeCloseTo(707.1067811865476, 6)
    expect(r.travelLabel).toBe('centreline-intersection-to-centreline-intersection')
  })

  test('V=300, H=0, θ=45° → T≈424.2640687119285, U=300', () => {
    const r = modeBOk(computeModeB(modeBInput(300, 0, 45)))
    expect(r.travel).toBeCloseTo(424.2640687119285, 6)
    expect(r.run).toBeCloseTo(300, 10)
  })
})

// ---------------------------------------------------------------------------
// Mode A spec fixture
// ---------------------------------------------------------------------------

describe('geometry-engine — Mode A fixture', () => {
  test('V=300, H=400, U=600 → T=781.0249675906654, θ≈39.8055710922652°', () => {
    const r = modeAOk(computeModeA(modeAInput(300, 400, 600)))
    expect(r.travel).toBeCloseTo(781.0249675906654, 6)
    expect(r.thetaDeg).toBeCloseTo(39.8055710922652, 6)
    expect(r.trueOffset).toBeCloseTo(500, 10)
  })

  test('selecting 45° for Mode A result (θ≈39.8°) blocks cut length', () => {
    const r = modeAOk(computeModeA(modeAInput(300, 400, 600)))
    const check = checkFittingAngle(r.thetaDeg, 45, 0.001)
    expect(check.match).toBe(false)
    expect(check.delta).toBeGreaterThan(5)
  })
})

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe('geometry-engine — validation', () => {
  test('Mode A rejects U ≤ 0', () => {
    const r = computeModeA(modeAInput(300, 400, 0))
    expect(r.kind).toBe('geometry-error')
  })

  test('Mode A rejects U < 0', () => {
    const r = computeModeA(modeAInput(300, 400, -100))
    expect(r.kind).toBe('geometry-error')
  })

  test('Mode B rejects θ = 0', () => {
    const r = computeModeB(modeBInput(300, 400, 0))
    expect(r.kind).toBe('geometry-error')
  })

  test('Mode B rejects θ = 90', () => {
    const r = computeModeB(modeBInput(300, 400, 90))
    expect(r.kind).toBe('geometry-error')
  })

  test('Mode B rejects zero true offset', () => {
    const r = computeModeB(modeBInput(0, 0, 45))
    expect(r.kind).toBe('geometry-error')
  })

  test('Mode A/B reject unconfirmed rise', () => {
    const unconfirmed = { ...mm(300), confirmed: false as const }
    const r = computeModeA({ rise: unconfirmed as never, roll: mm(400), run: mm(600) })
    expect(r.kind).toBe('geometry-error')
  })
})

// ---------------------------------------------------------------------------
// Metamorphic tests
// ---------------------------------------------------------------------------

describe('geometry-engine — metamorphic', () => {
  test('swap V/H preserves T (Mode A)', () => {
    const r1 = modeAOk(computeModeA(modeAInput(300, 400, 600)))
    const r2 = modeAOk(computeModeA(modeAInput(400, 300, 600)))
    expect(r1.travel).toBeCloseTo(r2.travel, 10)
  })

  test('swap V/H preserves T (Mode B)', () => {
    const r1 = modeBOk(computeModeB(modeBInput(300, 400, 45)))
    const r2 = modeBOk(computeModeB(modeBInput(400, 300, 45)))
    expect(r1.travel).toBeCloseTo(r2.travel, 10)
  })

  test('scaling all inputs by k scales T by k (Mode A)', () => {
    const k = 2.5
    const r1 = modeAOk(computeModeA(modeAInput(300, 400, 600)))
    const r2 = modeAOk(computeModeA(modeAInput(300 * k, 400 * k, 600 * k)))
    expect(r2.travel).toBeCloseTo(r1.travel * k, 6)
  })

  test('scaling all inputs by k scales T by k (Mode B)', () => {
    const k = 3
    const r1 = modeBOk(computeModeB(modeBInput(300, 400, 45)))
    const r2 = modeBOk(computeModeB(modeBInput(300 * k, 400 * k, 45)))
    expect(r2.travel).toBeCloseTo(r1.travel * k, 6)
  })

  test('imperial equivalent gives same T as mm (Mode A)', () => {
    // V=300mm = 11.811...in, H=400mm = 15.748...in, U=600mm = 23.622...in
    const inPerMm = 1 / 25.4
    const rMm = modeAOk(computeModeA(modeAInput(300, 400, 600)))
    const rIn = modeAOk(computeModeA({
      rise: { ...mm(300 * inPerMm * 25.4), valueMm: 300, valueIn: 300 * inPerMm },
      roll: { ...mm(400 * inPerMm * 25.4), valueMm: 400, valueIn: 400 * inPerMm },
      run: { ...mm(600 * inPerMm * 25.4), valueMm: 600, valueIn: 600 * inPerMm },
    }))
    expect(rIn.travel).toBeCloseTo(rMm.travel, 6)
  })
})

// ---------------------------------------------------------------------------
// checkFittingAngle
// ---------------------------------------------------------------------------

describe('checkFittingAngle', () => {
  test('exact match within tolerance', () => {
    expect(checkFittingAngle(45, 45, 0.001).match).toBe(true)
  })

  test('within tolerance', () => {
    const r = checkFittingAngle(44.9995, 45, 0.001)
    expect(r.match).toBe(true)
  })

  test('outside tolerance', () => {
    const r = checkFittingAngle(39.8, 45, 0.001)
    expect(r.match).toBe(false)
    expect(r.delta).toBeGreaterThan(5)
  })
})
