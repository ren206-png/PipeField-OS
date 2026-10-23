// ============================================================
// ISO Tap-to-Calculate — Project-Entered Engagement Record
// Route 2: user-entered engagement with named source.
// These records are local; they never enter the shared verified catalog.
// ============================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const ProjectEngagementRecordSchema = z.object({
  id: z.string().min(1),
  threadFamily: z.literal('NPT'),
  nominalSizeNps: z.string().min(1),
  standard: z.enum(['ASME B16.3', 'ASME B16.11']),
  fittingDescription: z.string().min(1),

  // Engagement measurement
  valueMm: z.number().finite().positive(),
  rangeMinMm: z.number().finite().positive(),
  rangeMaxMm: z.number().finite().positive(),

  // Provenance — bare guesses rejected (sourceDescription must not be empty)
  basis: z.literal('project-entered'),
  sourceDescription: z.string().min(1, 'Source description is required — name the manufacturer reference or documented measured assembly'),
  sourceType: z.enum(['manufacturer-data', 'measured-assembly', 'project-standard']),

  // Confirmation
  confirmedByUserId: z.string().min(1),
  confirmedByUserName: z.string().min(1),
  confirmedAt: z.string().datetime({ message: 'confirmedAt must be a valid ISO 8601 datetime string' }),

  // Org isolation — namespaced by org; cleared on account switch
  organizationId: z.string().min(1),
  projectLabel: z.string().optional(),

  label: z.literal('Project-entered values'),
})
  // Cross-field: valueMm must be within [rangeMinMm, rangeMaxMm]
  .refine(
    r => r.valueMm >= r.rangeMinMm && r.valueMm <= r.rangeMaxMm,
    { message: 'Target engagement valueMm must be within [rangeMinMm, rangeMaxMm]', path: ['valueMm'] },
  )
  // Cross-field: rangeMin <= rangeMax
  .refine(
    r => r.rangeMinMm <= r.rangeMaxMm,
    { message: 'rangeMinMm must be ≤ rangeMaxMm', path: ['rangeMinMm'] },
  )

export type ProjectEngagementRecord = z.infer<typeof ProjectEngagementRecordSchema>

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/** Validate raw unknown data as a ProjectEngagementRecord. Throws on invalid. */
export function validateProjectEngagementRecord(raw: unknown): ProjectEngagementRecord {
  return ProjectEngagementRecordSchema.parse(raw)
}
