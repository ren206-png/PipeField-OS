import {
  fromFeetInchesFraction,
  fromMm,
  fromInches,
  fromMetres,
  fromDegrees,
  fromDegreesMinutes,
  toMm,
  toInches,
  toDegrees,
  formatLength,
  type DisplayOpts,
} from '../types'

describe('fromFeetInchesFraction', () => {
  it('parses pure fraction: "5/16"', () => {
    const l = fromFeetInchesFraction('5/16')
    expect(toInches(l)).toBeCloseTo(5 / 16, 10)
  })

  it('parses hyphen-separated whole+fraction: "1-5/16"', () => {
    const l = fromFeetInchesFraction('1-5/16')
    expect(toInches(l)).toBeCloseTo(1 + 5 / 16, 10)
  })

  it('parses space-separated whole+fraction: "1 5/16"', () => {
    const l = fromFeetInchesFraction('1 5/16')
    expect(toInches(l)).toBeCloseTo(1 + 5 / 16, 10)
  })

  it('"1-5/16" equals "1 5/16" (hyphen = space separator)', () => {
    const a = fromFeetInchesFraction('1-5/16')
    const b = fromFeetInchesFraction('1 5/16')
    expect(toMm(a)).toBeCloseTo(toMm(b), 10)
  })

  it('parses bare decimal (inches): "43.3125"', () => {
    const l = fromFeetInchesFraction('43.3125')
    expect(toInches(l)).toBeCloseTo(43.3125, 10)
  })

  it('ADVERSARIAL 4.4-a: "43 5/16" must parse as 43 + 5/16 = 43.3125 in, NOT 13.4375', () => {
    const l = fromFeetInchesFraction('43 5/16')
    expect(toInches(l)).toBeCloseTo(43 + 5 / 16, 10) // 43.3125
    expect(toInches(l)).not.toBeCloseTo(43 * 5 / 16, 5) // NOT 13.4375
  })

  it('parses feet-inches-fraction: "3\' 7 5/16"', () => {
    const l = fromFeetInchesFraction("3' 7 5/16")
    expect(toInches(l)).toBeCloseTo(3 * 12 + 7 + 5 / 16, 10) // 43.3125
  })

  it('parses feet-inches-fraction with trailing quote: "3\' 7 5/16\""', () => {
    const l = fromFeetInchesFraction('3\' 7 5/16"')
    expect(toInches(l)).toBeCloseTo(43.3125, 10)
  })

  it('parses mm suffix: "1100mm"', () => {
    const l = fromFeetInchesFraction('1100mm')
    expect(toMm(l)).toBeCloseTo(1100, 10)
  })

  it('parses m suffix: "1.1m"', () => {
    const l = fromFeetInchesFraction('1.1m')
    expect(toMm(l)).toBeCloseTo(1100, 10)
  })

  it('parses feet only: "12\'"', () => {
    const l = fromFeetInchesFraction("12'")
    expect(toInches(l)).toBeCloseTo(144, 10)
  })

  it('parses zero: "0"', () => {
    const l = fromFeetInchesFraction('0')
    expect(toMm(l)).toBeCloseTo(0, 10)
  })

  it('rejects empty string', () => {
    expect(() => fromFeetInchesFraction('')).toThrow()
  })

  it('rejects non-numeric: "abc"', () => {
    expect(() => fromFeetInchesFraction('abc')).toThrow()
  })

  it('rejects denominator zero: "5/0"', () => {
    expect(() => fromFeetInchesFraction('5/0')).toThrow()
  })

  it('rejects denominator zero: "1-5/0"', () => {
    expect(() => fromFeetInchesFraction('1-5/0')).toThrow()
  })

  it('round-trip 1/16 increments 0 to 12 ft', () => {
    for (let sixteenths = 0; sixteenths <= 12 * 12 * 16; sixteenths++) {
      const inches = sixteenths / 16
      const l = fromInches(inches)
      expect(toInches(l)).toBeCloseTo(inches, 10)
    }
  })
})

describe('fromDegreesMinutes', () => {
  it('"22°30\'" → 22.5°', () => {
    const a = fromDegreesMinutes("22°30'")
    expect(toDegrees(a)).toBeCloseTo(22.5, 10)
  })

  it('"22.5" → 22.5°', () => {
    const a = fromDegreesMinutes('22.5')
    expect(toDegrees(a)).toBeCloseTo(22.5, 10)
  })

  it('"45" → 45°', () => {
    const a = fromDegreesMinutes('45')
    expect(toDegrees(a)).toBeCloseTo(45, 10)
  })
})

describe('fromMm / fromInches / fromMetres', () => {
  it('fromMm round-trip', () => {
    expect(toMm(fromMm(100))).toBeCloseTo(100, 10)
  })

  it('fromInches converts correctly', () => {
    expect(toMm(fromInches(1))).toBeCloseTo(25.4, 10)
  })

  it('fromMetres converts correctly', () => {
    expect(toMm(fromMetres(1))).toBeCloseTo(1000, 10)
  })

  it('throws on non-finite mm', () => {
    expect(() => fromMm(Infinity)).toThrow()
    expect(() => fromMm(NaN)).toThrow()
  })
})

describe('formatLength', () => {
  const imperial16: DisplayOpts = { unit: 'imperial', precision: '1/16' }
  const imperial32: DisplayOpts = { unit: 'imperial', precision: '1/32' }
  const metric: DisplayOpts = { unit: 'metric', precision: '1mm' }

  it('formats 0 mm as 0"', () => {
    expect(formatLength(fromMm(0), imperial16)).toBe('0"')
  })

  it('formats 25.4 mm as 1"', () => {
    expect(formatLength(fromInches(1), imperial16)).toBe('1"')
  })

  it('formats 3\' 7 5/16"', () => {
    // 43.3125 in = 3ft 7 5/16
    const l = fromInches(43.3125)
    expect(formatLength(l, imperial16)).toBe("3' 7 5/16\"")
  })

  it('formats metric: 1100 mm', () => {
    expect(formatLength(fromMm(1100), metric)).toBe('1100 mm')
  })

  it('ADVERSARIAL 4.4-b: rounding only at formatter, not before subtraction', () => {
    // If we subtract first (full precision) and then format, result differs from
    // if we rounded inputs before subtracting.
    // 914.4 - 152.4 - 152.4 = 609.6 mm = 24" exactly
    const ctc = fromMm(914.4)
    const to1 = fromMm(152.4)
    const to2 = fromMm(152.4)
    const cut = fromMm(toMm(ctc) - toMm(to1) - toMm(to2))
    // Must be exactly 609.6 mm (no rounding applied internally)
    expect(toMm(cut)).toBeCloseTo(609.6, 6)
    // 609.6 mm = 24 in = 2' — formatter correctly shows 2' (no trailing 0")
    expect(formatLength(cut, imperial16)).toBe("2'")
  })
})
