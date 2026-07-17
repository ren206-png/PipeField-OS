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

export async function runNdeSelection(input: NdeSelectionInput): Promise<NdeSelectionResult> {
  // Generate deterministic seed: timestamp + plan_id + type
  const seed = crypto
    .createHash('sha256')
    .update(`${input.nde_plan_id}:${input.inspection_type}:${Date.now()}`)
    .digest('hex')

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
      `Seed: ${seed}`,
  }
}
