// ============================================================
// p-number-coverage.ts
// ASME IX QW-422 P-Number grouping for qualification coverage.
//
// ENGINEERING_REVIEW_REQUIRED (RULE-002):
// All groupings must be verified against ASME IX QW-422 before
// enabling PFOS_QUAL_ENFORCEMENT in production.
//
// Rule: A welder qualified on P-number X is also qualified for
// all P-numbers listed in the "covers" array for X.
// P-number groupings are symmetrical within a group.
// ============================================================

interface PNumberGroup {
  p_number:  string
  covers:    string[]   // other P-numbers covered by this qualification
  metals:    string[]   // representative materials (informational)
  notes?:    string
}

// ENGINEERING_REVIEW_REQUIRED — verify against ASME IX QW-422
export const P_NUMBER_GROUPS: PNumberGroup[] = [
  // Group 1 — Carbon steel
  { p_number: 'P1',  covers: ['P1'],              metals: ['A53 Gr B', 'A106 Gr B', 'A333 Gr 6'] },
  // Group 3 — Alloy steel (Cr-Mo)
  { p_number: 'P3',  covers: ['P1','P3'],          metals: ['A335 P5', 'A335 P9'],
    notes: 'P3 qualified on P3 also qualifies for P1 per QW-422' },
  // Group 4 — Cr-Mo (higher alloy)
  { p_number: 'P4',  covers: ['P1','P3','P4'],     metals: ['A335 P11', 'A335 P12'] },
  // Group 5A — Cr-Mo (5 Cr)
  { p_number: 'P5A', covers: ['P1','P3','P4','P5A'], metals: ['A335 P5', 'A335 P9'] },
  // Group 8 — Austenitic stainless
  { p_number: 'P8',  covers: ['P8'],               metals: ['A312 TP304', 'A312 TP316', 'A312 TP316L'] },
  // Group 9A — Non-ferrous nickel
  { p_number: 'P9A', covers: ['P9A'],              metals: ['A333 Gr 3'] },
  // Group 10H — High alloy ferrous
  { p_number: 'P10H',covers: ['P10H'],             metals: ['Duplex 2205'] },
  // Group 15E — Ferritic stainless
  { p_number: 'P15E',covers: ['P15E'],             metals: ['A268 TP430'] },
  // Group 31-37 — Aluminum (non-ferrous; requires separate qual)
  { p_number: 'P21', covers: ['P21'],              metals: ['Aluminum 6061'] },
  { p_number: 'P22', covers: ['P21','P22'],        metals: ['Aluminum 5052', 'Aluminum 5083'] },
  // Group 41-49 — Copper and copper alloys
  { p_number: 'P31', covers: ['P31'],              metals: ['Copper A193'] },
]

const MAP = new Map(P_NUMBER_GROUPS.map(g => [g.p_number, g]))

/**
 * Returns true if a welder qualified on `qualifiedOn` also covers `required`.
 * ENGINEERING_REVIEW_REQUIRED (RULE-002) before use in production enforcement.
 */
export function pNumberCovers(qualifiedOn: string, required: string): boolean {
  if (qualifiedOn === required) return true
  const group = MAP.get(qualifiedOn)
  return group ? group.covers.includes(required) : false
}
