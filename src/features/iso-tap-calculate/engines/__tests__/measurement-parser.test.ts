import { parseMeasurement } from '../measurement-parser'
import type { ParseContext, Measurement } from '../schemas'

const ctxMm: ParseContext = { allowNegative: false, projectUnit: 'mm', sourceType: 'manual' }
const ctxIn: ParseContext = { allowNegative: false, projectUnit: 'in', sourceType: 'manual' }
const ctxNeg: ParseContext = { allowNegative: true, projectUnit: 'mm', sourceType: 'manual' }
const ctxOcr: ParseContext = { allowNegative: false, projectUnit: 'mm', sourceType: 'ocr' }

function ok(result: ReturnType<typeof parseMeasurement>): Measurement {
  if (result.kind !== 'measurement') throw new Error(`Expected measurement, got ${result.kind}: ${JSON.stringify(result)}`)
  return result
}

function err(result: ReturnType<typeof parseMeasurement>): string {
  if (result.kind !== 'parse-error') throw new Error(`Expected parse-error, got ${result.kind}`)
  return result.code
}

describe('measurement-parser — mm', () => {
  test('plain mm value', () => {
    const m = ok(parseMeasurement('300 mm', ctxMm))
    expect(m.valueMm).toBe(300)
    expect(m.originalUnit).toBe('mm')
    expect(m.confirmed).toBe(false)
  })

  test('mm without space', () => {
    const m = ok(parseMeasurement('1100mm', ctxMm))
    expect(m.valueMm).toBe(1100)
  })

  test('decimal mm', () => {
    const m = ok(parseMeasurement('984.25 mm', ctxMm))
    expect(m.valueMm).toBeCloseTo(984.25)
  })
})

describe('measurement-parser — inches', () => {
  test('decimal inches with "in"', () => {
    const m = ok(parseMeasurement('3.75 in', ctxIn))
    expect(m.valueMm).toBeCloseTo(3.75 * 25.4)
    expect(m.originalUnit).toBe('in')
  })

  test('decimal inches with " mark', () => {
    const m = ok(parseMeasurement('3.75"', ctxIn))
    expect(m.valueMm).toBeCloseTo(3.75 * 25.4)
  })

  test('mixed whole + fraction "3 3/4"', () => {
    const m = ok(parseMeasurement('3 3/4"', ctxIn))
    expect(m.valueMm).toBeCloseTo(3.75 * 25.4)
  })

  test('unicode fraction ¾"', () => {
    const m = ok(parseMeasurement('3¾"', ctxIn))
    expect(m.valueMm).toBeCloseTo(3.75 * 25.4)
  })
})

describe('measurement-parser — feet-inches', () => {
  test("3'-2 3/4\" = 38.75 in = 984.25 mm", () => {
    const m = ok(parseMeasurement("3'-2 3/4\"", ctxIn))
    expect(m.valueMm).toBeCloseTo(984.25, 6)
    expect(m.valueIn).toBeCloseTo(38.75, 10)
    expect(m.originalUnit).toBe('ft-in')
  })

  test("3' 2 3/4\" (space separator)", () => {
    const m = ok(parseMeasurement("3' 2 3/4\"", ctxIn))
    expect(m.valueMm).toBeCloseTo(984.25, 6)
  })

  test("12' = 144 in", () => {
    const m = ok(parseMeasurement("12'", ctxIn))
    expect(m.valueIn).toBeCloseTo(144)
  })
})

describe('measurement-parser — unitless', () => {
  test('unitless bare number with mm context', () => {
    const m = ok(parseMeasurement('300', ctxMm))
    expect(m.valueMm).toBe(300)
    expect(m.originalUnit).toBe('mm')
  })

  test('unitless bare number with in context', () => {
    const m = ok(parseMeasurement('300', ctxIn))
    expect(m.valueMm).toBeCloseTo(300 * 25.4)
    expect(m.originalUnit).toBe('in')
  })
})

describe('measurement-parser — source type', () => {
  test('ocr source type preserved', () => {
    const m = ok(parseMeasurement('300 mm', ctxOcr))
    expect(m.sourceType).toBe('ocr')
    expect(m.confirmed).toBe(false)
  })

  test('manual source type preserved', () => {
    const m = ok(parseMeasurement('300 mm', ctxMm))
    expect(m.sourceType).toBe('manual')
  })
})

describe('measurement-parser — signed values', () => {
  test('negative rejected when allowNegative=false', () => {
    expect(err(parseMeasurement('-150 mm', ctxMm))).toBe('NEGATIVE_NOT_ALLOWED')
  })

  test('negative allowed when allowNegative=true', () => {
    const m = ok(parseMeasurement('-150 mm', ctxNeg))
    expect(m.valueMm).toBe(-150)
  })
})

describe('measurement-parser — rejection cases', () => {
  test('zero denominator', () => {
    expect(err(parseMeasurement('1/0"', ctxIn))).toBe('ZERO_DENOMINATOR')
  })

  test('malformed fraction — space before slash', () => {
    expect(err(parseMeasurement('3 /4"', ctxIn))).toBe('MALFORMED_FRACTION')
  })

  test('conflicting unit markers', () => {
    expect(err(parseMeasurement('300 mm in', ctxMm))).toBe('CONFLICTING_UNITS')
  })

  test('NPS callout — "1/2 NPS"', () => {
    expect(err(parseMeasurement('1/2 NPS', ctxIn))).toBe('NPS_CALLOUT')
  })

  test('NPS callout — "NPS 2"', () => {
    expect(err(parseMeasurement('NPS 2', ctxIn))).toBe('NPS_CALLOUT')
  })

  test('NPS callout — "DN 15"', () => {
    expect(err(parseMeasurement('DN 15', ctxMm))).toBe('NPS_CALLOUT')
  })

  test('normal fraction 3/4" is NOT an NPS callout', () => {
    const m = ok(parseMeasurement('3/4"', ctxIn))
    expect(m.valueMm).toBeCloseTo(0.75 * 25.4)
  })

  test('ambiguous decimal/thousands separator comma', () => {
    expect(err(parseMeasurement('1,000', ctxMm))).toBe('AMBIGUOUS_SEPARATOR')
  })
})

describe('measurement-parser — unicode normalisation', () => {
  test('½ → 1/2', () => {
    const m = ok(parseMeasurement('3½"', ctxIn))
    expect(m.valueMm).toBeCloseTo(3.5 * 25.4)
  })

  test('¼ → 1/4', () => {
    const m = ok(parseMeasurement('2¼"', ctxIn))
    expect(m.valueMm).toBeCloseTo(2.25 * 25.4)
  })

  test('unicode curly double-quote (inch mark) normalised', () => {
    // “ = " (left), ” = " (right) — both normalise to " (ASCII inch mark)
    const m = ok(parseMeasurement('3.75”', ctxIn))
    expect(m.valueMm).toBeCloseTo(3.75 * 25.4)
  })
})
