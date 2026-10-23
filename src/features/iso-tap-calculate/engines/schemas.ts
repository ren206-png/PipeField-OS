// ============================================================
// ISO Tap-to-Calculate — Zod Schemas
// Pure TypeScript. Zero framework/DB/browser imports.
// ============================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export const MeasurementSchema = z.object({
  kind: z.literal('measurement'),
  rawText: z.string(),
  normalizedText: z.string(),
  originalUnit: z.enum(['mm', 'in', 'ft-in']),
  valueMm: z.number().finite(),
  valueIn: z.number().finite(),
  sourceType: z.enum(['ocr', 'manual']),
  confirmed: z.boolean(),
})
export type Measurement = z.infer<typeof MeasurementSchema>

export const ConfirmedMeasurementSchema = MeasurementSchema.extend({
  confirmed: z.literal(true),
})
export type ConfirmedMeasurement = z.infer<typeof ConfirmedMeasurementSchema>

// ---------------------------------------------------------------------------
// ParseError / AmbiguityError
// ---------------------------------------------------------------------------

export const ParseErrorCodeSchema = z.enum([
  'ZERO_DENOMINATOR',
  'MALFORMED_FRACTION',
  'CONFLICTING_UNITS',
  'NONFINITE',
  'UNITLESS_NEEDS_CONFIRMATION',
  'NPS_CALLOUT',
  'NEGATIVE_NOT_ALLOWED',
  'AMBIGUOUS_SEPARATOR',
])
export type ParseErrorCode = z.infer<typeof ParseErrorCodeSchema>

export const ParseErrorSchema = z.object({
  kind: z.literal('parse-error'),
  rawText: z.string(),
  reason: z.string(),
  code: ParseErrorCodeSchema,
})
export type ParseError = z.infer<typeof ParseErrorSchema>

export const AmbiguityErrorSchema = z.object({
  kind: z.literal('ambiguity'),
  rawText: z.string(),
  candidates: z.array(MeasurementSchema),
  reason: z.string(),
})
export type AmbiguityError = z.infer<typeof AmbiguityErrorSchema>

export type ParseResult = Measurement | ParseError | AmbiguityError

// ---------------------------------------------------------------------------
// ParseContext
// ---------------------------------------------------------------------------

export const ParseContextSchema = z.object({
  allowNegative: z.boolean(),
  projectUnit: z.enum(['mm', 'in']),
  sourceType: z.enum(['ocr', 'manual']),
})
export type ParseContext = z.infer<typeof ParseContextSchema>

// ---------------------------------------------------------------------------
// Geometry Engine
// ---------------------------------------------------------------------------

export const ModeAInputSchema = z.object({
  rise: ConfirmedMeasurementSchema,
  roll: ConfirmedMeasurementSchema,
  run: ConfirmedMeasurementSchema,
})
export type ModeAInput = z.infer<typeof ModeAInputSchema>

export const ModeAResultSchema = z.object({
  kind: z.literal('mode-a'),
  trueOffset: z.number().finite(),
  travel: z.number().finite().positive(),
  thetaDeg: z.number().finite(),
})
export type ModeAResult = z.infer<typeof ModeAResultSchema>

export const ModeBInputSchema = z.object({
  rise: ConfirmedMeasurementSchema,
  roll: ConfirmedMeasurementSchema,
  angleDeg: z.number().finite().gt(0).lt(90),
})
export type ModeBInput = z.infer<typeof ModeBInputSchema>

export const ModeBResultSchema = z.object({
  kind: z.literal('mode-b'),
  trueOffset: z.number().finite().nonnegative(),
  travel: z.number().finite().positive(),
  run: z.number().finite().nonnegative(),
  travelLabel: z.literal('centreline-intersection-to-centreline-intersection'),
})
export type ModeBResult = z.infer<typeof ModeBResultSchema>

export const GeometryErrorSchema = z.object({
  kind: z.literal('geometry-error'),
  reason: z.string(),
  field: z.string(),
})
export type GeometryError = z.infer<typeof GeometryErrorSchema>

// ---------------------------------------------------------------------------
// BW Strategy
// ---------------------------------------------------------------------------

export const BwFittingDeductionSchema = z.object({
  deductionMm: z.number().finite().positive(),
  verified: z.boolean(),
  sourceDoc: z.string().min(1),
  nominalSizeNps: z.string().min(1),
  angleDeg: z.number().finite().positive(),
})
export type BwFittingDeduction = z.infer<typeof BwFittingDeductionSchema>

export const ConfirmedGapSchema = z.object({
  valueMm: z.number().finite().nonnegative(),
  confirmed: z.boolean(),
})
export type ConfirmedGap = z.infer<typeof ConfirmedGapSchema>

export const BwInputSchema = z.object({
  travel: z.number().finite().positive(),
  fittingA: BwFittingDeductionSchema,
  fittingB: BwFittingDeductionSchema,
  gapA: ConfirmedGapSchema,
  gapB: ConfirmedGapSchema,
})
export type BwInput = z.infer<typeof BwInputSchema>

export const BwResultSchema = z.object({
  kind: z.literal('bw-result'),
  cutLengthMm: z.number().finite().positive(),
  breakdown: z.object({
    travel: z.number(),
    deductionA: z.number(),
    deductionB: z.number(),
    gapA: z.number(),
    gapB: z.number(),
  }),
})
export type BwResult = z.infer<typeof BwResultSchema>

export const BwErrorSchema = z.object({
  kind: z.literal('bw-error'),
  reason: z.string(),
  field: z.string(),
})
export type BwError = z.infer<typeof BwErrorSchema>

// ---------------------------------------------------------------------------
// Threaded NPT Strategy
// ---------------------------------------------------------------------------

export const EngagementRecordSchema = z.object({
  basis: z.literal('project-entered'),
  valueMm: z.number().finite().positive(),
  rangeMinMm: z.number().finite().positive(),
  rangeMaxMm: z.number().finite().positive(),
  sourceDescription: z.string().min(1, 'Source description is required'),
  confirmedByUser: z.boolean(),
  confirmedAt: z.string().datetime(),
})
export type EngagementRecord = z.infer<typeof EngagementRecordSchema>

export const ThreadedFittingSpecSchema = z.object({
  threadFamily: z.literal('NPT'),
  nominalSizeNps: z.string().min(1),
  angleDeg: z.number().finite().positive(),
  faceDistanceMm: z.number().finite().positive(),
  faceDistanceVerified: z.boolean(),
  faceDistanceSource: z.string().min(1),
  engagement: EngagementRecordSchema,
})
export type ThreadedFittingSpec = z.infer<typeof ThreadedFittingSpecSchema>

export const ThreadedOffsetInputSchema = z.object({
  inputMode: z.literal('offset-derived-c'),
  c: z.number().finite().positive(),
  fitting1: ThreadedFittingSpecSchema,
  fitting2: ThreadedFittingSpecSchema,
})
export type ThreadedOffsetInput = z.infer<typeof ThreadedOffsetInputSchema>

export const ThreadedDirectCTCInputSchema = z.object({
  inputMode: z.literal('direct-c'),
  c: z.number().finite().positive(),
  axisConfirmed: z.literal(true),
  fitting1: ThreadedFittingSpecSchema,
  fitting2: ThreadedFittingSpecSchema,
})
export type ThreadedDirectCTCInput = z.infer<typeof ThreadedDirectCTCInputSchema>

export const ThreadedDirectFTFInputSchema = z.object({
  inputMode: z.literal('direct-ftf'),
  b: z.number().finite().nonnegative(),
  axisConfirmed: z.literal(true),
  fitting1: ThreadedFittingSpecSchema,
  fitting2: ThreadedFittingSpecSchema,
})
export type ThreadedDirectFTFInput = z.infer<typeof ThreadedDirectFTFInputSchema>

export type ThreadedInput = ThreadedOffsetInput | ThreadedDirectCTCInput | ThreadedDirectFTFInput

export const ThreadedResultSchema = z.object({
  kind: z.literal('threaded-result'),
  cutLengthMm: z.number().finite().positive().nullable(),
  targetNotConfirmed: z.boolean().optional(),
  cutLengthRangeMm: z.tuple([z.number().finite(), z.number().finite()]),
  b: z.number().finite().nonnegative(),
  breakdown: z.object({
    c: z.number().optional(),
    b: z.number().optional(),
    f1: z.number(),
    f2: z.number(),
    e1: z.number(),
    e2: z.number(),
    d1: z.number(),
    d2: z.number(),
    formula: z.string(),
  }),
  label: z.literal('finished-end-to-end-length-including-inserted-ends'),
  warnings: z.array(z.string()),
})
export type ThreadedResult = z.infer<typeof ThreadedResultSchema>

export const ThreadedErrorSchema = z.object({
  kind: z.literal('threaded-error'),
  reason: z.string(),
  field: z.string(),
})
export type ThreadedError = z.infer<typeof ThreadedErrorSchema>
