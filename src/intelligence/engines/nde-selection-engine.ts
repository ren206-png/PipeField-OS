// ============================================================
// NDE Selection Engine
// Deterministic, seed-based weld selection for NDE programs.
//
// ENGINEERING_REVIEW_REQUIRED: All sampling percentages,
// progressive trigger counts, and progressive add percentages
// are engineering defaults. They MUST be reviewed and approved
// by a qualified engineer before use in a code-compliant NDE
// program.
// ============================================================
import crypto from 'crypto'

// ENGINEERING_REVIEW_REQUIRED: All sampling percentages, progressive trigger counts,
// and progressive add percentages are engineering defaults. They MUST be reviewed
// and approved by a qualified engineer before use in a code-compliant NDE program.

export interface NdeSelectionInput {
  nde_plan_id: string
  organization_id: string
  weld_ids: string[]       // all eligible weld IDs for this selection run
  inspection_type: 'RT' | 'UT' | 'VT' | 'PT' | 'MT'
  sampling_pct: number     // from code profile — ENGINEERING_REVIEW_REQUIRED
  progressive_trigger_count: number  // ENGINEERING_REVIEW_REQUIRED
  progressive_add_pct: number        // ENGINEERING_REVIEW_REQUIRED
  prior_fail_weld_ids?: string[]     // welds that failed — triggers progressive penalty
}

export interface NdeSelectionResult {
  selected: {
    weld_id: string
    selection_rank: number
    selection_reason: 'random_sample' | 'progressive_penalty' | 'repair_followup'
  }[]
  seed: string
  total_eligible: number
  base_count: number
  progressive_count: number
  engineering_note: string
}

/**
 * Generate a stable, reproducible seed for an NDE selection run.
 * Seed is scoped to (plan_id + inspection_type) only — NOT time-dependent.
 * This ensures that re-running selection against the same plan + type always
 * produces the same ranked order, so historical audits are reproducible.
 *
 * The seed must be persisted to nde_selections rows (seed_hex column) so
 * any future re-run uses the original stored seed rather than recomputing.
 */
export function generateNdeSeed(ndePlanId: string, inspectionType: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ndePlanId}:${inspectionType}`)
    .digest('hex')
}

export async function runNdeSelection(input: NdeSelectionInput): Promise<NdeSelectionResult> {
  // Generate deterministic, time-independent seed scoped to plan + type.
  // Previously included Date.now() which made audits non-reproducible (R2 fix).
  const seed = generateNdeSeed(input.nde_plan_id, input.inspection_type)

  // Deterministic sort: hash(weld_id + seed) → numeric score
  const scored = input.weld_ids.map(weld_id => {
    const score = parseInt(
      crypto.createHash('sha256').update(`${weld_id}:${seed}`).digest('hex').slice(0, 8),
      16
    )
    return { weld_id, score }
  }).sort((a, b) => a.score - b.score)

  // Base sample count — ENGINEERING_REVIEW_REQUIRED
  const baseCount = Math.ceil(input.weld_ids.length * input.sampling_pct / 100)

  // Progressive penalty — ENGINEERING_REVIEW_REQUIRED
  const priorFails = input.prior_fail_weld_ids?.length ?? 0
  const progressiveCount = priorFails >= input.progressive_trigger_count
    ? Math.ceil(input.weld_ids.length * input.progressive_add_pct / 100)
    : 0

  const totalCount = Math.min(baseCount + progressiveCount, input.weld_ids.length)
  const baseSelected = new Set(scored.slice(0, baseCount).map(s => s.weld_id))
  const progressiveSet = new Set(
    scored.slice(baseCount, baseCount + progressiveCount).map(s => s.weld_id)
  )

  const selected = scored.slice(0, totalCount).map((s, i) => ({
    weld_id: s.weld_id,
    selection_rank: i + 1,
    selection_reason: (baseSelected.has(s.weld_id)
      ? 'random_sample'
      : progressiveSet.has(s.weld_id)
        ? 'progressive_penalty'
        : 'random_sample') as 'random_sample' | 'progressive_penalty' | 'repair_followup',
  }))

  return {
    selected,
    seed,
    total_eligible: input.weld_ids.length,
    base_count: baseCount,
    progressive_count: progressiveCount,
    // ENGINEERING_REVIEW_REQUIRED
    engineering_note:
      'ENGINEERING_REVIEW_REQUIRED: NDE sampling percentages and progressive trigger thresholds ' +
      'are engineering defaults stored in the code profile. They must be reviewed and approved ' +
      'by a qualified engineer before use in a code-compliant NDE program. ' +
      `Seed (persist to nde_selections.seed_hex for audit reproducibility): ${seed}`,
  }
}

// ============================================================
// checkNdePersonnel — Sprint 9
// Validates that an NDE inspector is qualified to perform and
// interpret a given method.
//
// Rules enforced:
//   1. Inspector must have method in their methods array
//   2. Level I cannot independently interpret results (must have Level II+)
//   3. Certification must not be expired
//   4. Vision test must be within 12 months (ASME Sec V T-120)
//   5. For SNT-TC-1A: current employment must match cert employer
//      (not enforced automatically — flagged in result)
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'

export type NdeMethod = 'RT' | 'UT' | 'MT' | 'PT' | 'VT'

export interface NdePersonnelCheckResult {
  qualified:        boolean
  reason:           string
  warnings:         string[]  // non-blocking advisory items
  inspectorLevel:   string | null
  certBody:         string | null
}

export async function checkNdePersonnel(
  personnelId: string,
  method: NdeMethod
): Promise<NdePersonnelCheckResult> {
  const admin = createAdminClient()

  const { data: person } = await admin
    .from('nde_personnel')
    .select('id, name, methods, level, expiry_date, vision_test_date, employer, certification_body, active')
    .eq('id', personnelId)
    .maybeSingle()

  if (!person || !person.active) {
    return {
      qualified: false,
      reason: person ? 'Inspector is marked inactive.' : 'Inspector not found.',
      warnings: [],
      inspectorLevel: null,
      certBody: null,
    }
  }

  const warnings: string[] = []

  // 1. Method coverage
  const methods = person.methods as string[]
  if (!methods.includes(method)) {
    return {
      qualified: false,
      reason: `Inspector "${person.name}" is not certified for ${method}. Certified methods: ${methods.join(', ')}.`,
      warnings,
      inspectorLevel: person.level as string,
      certBody: person.certification_body as string,
    }
  }

  // 2. Level check (Level I cannot independently interpret)
  if (person.level === 'I') {
    return {
      qualified: false,
      reason: 'Level I NDE personnel cannot independently perform and interpret results. Assign a Level II or III inspector.',
      warnings,
      inspectorLevel: 'I',
      certBody: person.certification_body as string,
    }
  }

  // 3. Certification expiry
  if (person.expiry_date) {
    const expiry = new Date(person.expiry_date as string)
    if (expiry < new Date()) {
      return {
        qualified: false,
        reason: `Certification expired on ${person.expiry_date}. Renewal required.`,
        warnings,
        inspectorLevel: person.level as string,
        certBody: person.certification_body as string,
      }
    }
    // Warn if expiring within 30 days
    const daysToExpiry = Math.floor((expiry.getTime() - Date.now()) / 86_400_000)
    if (daysToExpiry <= 30) {
      warnings.push(`Certification expires in ${daysToExpiry} days (${person.expiry_date}).`)
    }
  }

  // 4. Vision test (must be within 12 months per ASME Sec V T-120)
  if (person.vision_test_date) {
    const visionDate = new Date(person.vision_test_date as string)
    const daysSince = Math.floor((Date.now() - visionDate.getTime()) / 86_400_000)
    if (daysSince > 365) {
      return {
        qualified: false,
        reason: `Near-vision test is overdue (${daysSince} days since last test). Annual vision test required per ASME Sec V T-120.`,
        warnings,
        inspectorLevel: person.level as string,
        certBody: person.certification_body as string,
      }
    }
    if (daysSince > 335) {
      warnings.push(`Vision test due within ${365 - daysSince} days.`)
    }
  } else {
    warnings.push('No vision test date recorded. ASME Sec V T-120 requires annual near-vision verification.')
  }

  // 5. SNT-TC-1A employer advisory (cannot auto-enforce without current employer data)
  if (person.certification_body === 'SNT-TC-1A' && person.employer) {
    warnings.push(
      `SNT-TC-1A is employer-based. Verify inspector is currently employed by "${person.employer}". ` +
      'Certification is invalid if inspector has changed employers without re-certification.'
    )
  }

  return {
    qualified: true,
    reason: `${person.name} (Level ${person.level}, ${person.certification_body}) is qualified to perform and interpret ${method}.`,
    warnings,
    inspectorLevel: person.level as string,
    certBody: person.certification_body as string,
  }
}
