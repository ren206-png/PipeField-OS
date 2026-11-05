import {
  binarizeAndStripLines,
  normalizeReading,
  fractionAlternatives,
  hasDrawingFractions,
  splitRunTogetherFraction,
  planLevelledCrop,
  rankReadings,
  textLineThickness,
} from '../level-crop'

describe('textLineThickness', () => {
  test('horizontal text: thickness is the box height', () => {
    expect(textLineThickness(80, 30, 0)).toBe(30)
  })
  test('vertical text: thickness is the box width', () => {
    expect(textLineThickness(30, 80, 90)).toBe(30)
    expect(textLineThickness(30, 80, -90)).toBe(30)
  })
  test('recovers the thickness of a 30° line from its bounding box', () => {
    const L = 60, t = 26, r = Math.PI / 6
    const w = L * Math.cos(r) + t * Math.sin(r)
    const h = L * Math.sin(r) + t * Math.cos(r)
    expect(textLineThickness(w, h, 30)).toBeCloseTo(t, 6)
    expect(textLineThickness(w, h, -30)).toBeCloseTo(t, 6)
  })
  test('falls back to the short side when the box does not fit the angle', () => {
    // a tall thin box cannot hold text at 30°
    expect(textLineThickness(20, 200, 30)).toBe(20)
  })
})

describe('planLevelledCrop', () => {
  test('strip is long enough for the diagonal and one line high', () => {
    const p = planLevelledCrop(30, 80, 90, 3)
    expect(p.width).toBeGreaterThanOrEqual(Math.ceil(Math.hypot(30, 80) * 3))
    expect(p.height).toBeLessThan(p.width)
    expect(p.linePx).toBeCloseTo(90, 6)
    expect(p.maxRunPx).toBeCloseTo(72, 6)
  })
})

function grid(rows: string[]): { px: Uint8ClampedArray; w: number; h: number } {
  const h = rows.length, w = rows[0].length
  const px = new Uint8ClampedArray(w * h * 4)
  rows.forEach((row, y) => row.split("").forEach((ch, x) => {
    const v = ch === '#' ? 0 : 255
    const i = (y * w + x) * 4
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255
  }))
  return { px, w, h }
}
function dump(px: Uint8ClampedArray, w: number, h: number): string[] {
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (px[(y * w + x) * 4] === 0 ? '#' : '.')).join(''))
}

describe('binarizeAndStripLines', () => {
  test('erases long horizontal runs but keeps short glyph strokes', () => {
    const { px, w, h } = grid([
      '####################', // dimension line: 20 long
      '..#....###....#.....', // glyph strokes: 1–3 long
      '..#.....#.....#.....',
    ])
    binarizeAndStripLines(px, w, h, 5)
    expect(dump(px, w, h)).toEqual([
      '....................',
      '..#....###....#.....',
      '..#.....#.....#.....',
    ])
  })
  test('binarises grey pixels by luminance', () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255, 220, 220, 220, 255])
    binarizeAndStripLines(px, 2, 1, 10)
    expect(Array.from(px)).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })
})

describe('rankReadings', () => {
  const isLength = (s: string) => /^\d+(\s\d+\/\d+)?"?$/.test(s)
  const r = (text: string, confidence: number, angle = 0) => ({ text, confidence, angle, scale: 2 })

  test('a valid length beats a higher-confidence reading that is not a length', () => {
    const out = rankReadings([r('5/ 0', 0.9, 0), r('300', 0.05, -30)], isLength)
    expect(out[0].text).toBe('300')
  })
  test('more digits win when both are valid', () => {
    const out = rankReadings([r('2', 0.3, -90), r('12"', 0.44, -90)], isLength)
    expect(out.map(x => x.text)).toEqual(['12"', '2'])
  })
  test('drops readings with no digits and de-duplicates', () => {
    const out = rankReadings([r('', 0), r('n', 0.2), r('450', 0.6), r(' 450 ', 0.79, -90)], isLength)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ text: '450', confidence: 0.79, angle: -90 })
  })
  test('returns at most `limit` readings', () => {
    const out = rankReadings([r('1', .1), r('2', .2), r('3', .3), r('4', .4)], isLength, 3)
    expect(out).toHaveLength(3)
  })
})

describe('splitRunTogetherFraction', () => {
  test.each([
    ['81/2"', '8 1/2"'],
    ['143/4"', '14 3/4"'],
    ['1215/16', '12 15/16'],
    ["2'-63/8\"", "2'-6 3/8\""],
    ['37/8', '3 7/8'],
  ])('%s → %s', (input, expected) => {
    expect(splitRunTogetherFraction(input)).toBe(expected)
  })
  test.each(['1/2"', '3/4', '8 1/2"', '450', '15/16', '600mm', '12/5'])('leaves %s alone', s => {
    expect(splitRunTogetherFraction(s)).toBe(s)
  })
  test('ambiguous sixteenths offer both splits', () => {
    expect(fractionAlternatives('1215/16')).toEqual(['12 15/16', '121 5/16'])
  })
  test('rankReadings offers every split as its own reading', () => {
    const out = rankReadings([{ text: '1215/16', confidence: 0.6, angle: 0, scale: 2 }], () => true)
    expect(out.map(x => x.text).sort()).toEqual(['12 15/16', '121 5/16'])
  })
  test('normalizeReading collapses spaces and splits', () => {
    expect(normalizeReading('  81/2"  ')).toBe('8 1/2"')
  })
})

describe('hasDrawingFractions', () => {
  test.each(['14 3/4"', '1/2', "2'-6 3/8\"", '450', '12 15/16'])('%s is a drawing value', s => {
    expect(hasDrawingFractions(s)).toBe(true)
  })
  test.each(['143/14"', '3/10', '1/3', '7/0'])('%s is a misread', s => {
    expect(hasDrawingFractions(s)).toBe(false)
  })
  test('rankReadings drops misread fractions (live: "14 3/4" read as "143/14")', () => {
    const out = rankReadings([
      { text: '143/14"', confidence: 0.7, angle: 30, scale: 2 },
      { text: '9', confidence: 0.3, angle: 0, scale: 2 },
    ], () => true)
    expect(out.map(x => x.text)).toEqual(['9'])
  })
})
