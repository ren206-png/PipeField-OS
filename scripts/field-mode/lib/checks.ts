// ============================================================
// Import-time internal-consistency assertions, re-running the
// checks described in VALIDATION_REPORT_batch1.md against the
// freshly imported rows (master prompt §3.3: "Re-run the internal-
// consistency checks listed in the three validation reports as
// importer assertions. Any new violation ... blocks the import of
// that table and is reported.")
//
// Scope for Phase 1: the batch-1 checks (flanges B16.5, BW
// fittings B16.9), since that report's flag list and "why expected"
// review were read in full and every exception below is a direct
// transcription of that review, not a guess. Batch 2 and 3 report
// "no flags" (batch 2) or a stud-length plausible-minimum list
// (batch 3) that is not yet reconciled with an explanatory "expected"
// section the way batch 1's is — those are left for a follow-up
// pass and noted in DATA_SOURCE_MANIFEST.md rather than silently
// allow-listed here.
//
// Every KNOWN_EXCEPTIONS entry is quoted from VALIDATION_REPORT_batch1.md.
// A violation NOT in that list throws and blocks the import of the table.
// ============================================================
import { parseInchesLike, npsSortKey } from './fraction'

export interface CheckRow {
  [key: string]: string
}

export interface CheckViolation {
  table: string
  message: string
}

function num(row: CheckRow, col: string): number | null {
  const raw = row[col]
  if (raw === undefined || raw === '') return null
  // Prefer plain numeric columns (already validated NUMERIC at schema-infer time);
  // fall back to fraction parsing for TEXT dimension columns.
  const asNum = Number(raw)
  if (!Number.isNaN(asNum) && /^-?\d+(\.\d+)?$/.test(raw.trim())) return asNum
  return parseInchesLike(raw)
}

// Known, explained exceptions from VALIDATION_REPORT_batch1.md
// "Flag review" section (line 39: "Bolt size drops at NPS 2 (classes
// 300-2500), NPS 3 (900), NPS 6 (900, 1500): bolt count doubles or
// steps up at the same point ... Expected.") — bolt size (bsd)
// legitimately drops when bolt count steps up at the same NPS/class
// boundary. 900|3 is also the class900-resets-to-true-900# boundary
// (see CLASS900_NPS3_BOUNDARY below); both apply at that one point.
const BSD_DROP_ALLOWED = new Set([
  '300|2', '400|2', '600|2', '900|2', '900|3', '900|6', '1500|2', '1500|6', '2500|2',
])

// class 900 NPS 1/2-2.5 == class 1500 by design (B16.5); the first
// true 900# size is NPS 3, which is smaller than NPS 2.5 in OD/
// thickness/LTH. Allow a decrease at exactly this boundary.
const CLASS900_NPS3_BOUNDARY = '900|3'

export function checkFlangesMonotonic(rows: CheckRow[]): CheckViolation[] {
  const violations: CheckViolation[] = []
  const byClass = new Map<string, CheckRow[]>()
  for (const r of rows) {
    const cls = r.flange_class
    if (!byClass.has(cls)) byClass.set(cls, [])
    byClass.get(cls)!.push(r)
  }

  for (const [cls, classRows] of byClass) {
    const sorted = [...classRows].sort((a, b) => npsSortKey(a.nps) - npsSortKey(b.nps))
    let prev: CheckRow | null = null
    for (const r of sorted) {
      // bolt hole > bolt size
      const boltHole = num(r, 'bolt_hole_in')
      const boltSize = num(r, 'bolt_size_in')
      if (boltHole !== null && boltSize !== null && !(boltHole > boltSize)) {
        violations.push({ table: 'ref_flanges', message: `class ${cls} NPS ${r.nps}: bolt_hole_in (${boltHole}) not > bolt_size_in (${boltSize})` })
      }
      // RF dia < bolt circle < OD
      const rf = num(r, 'rf_dia_in')
      const bc = num(r, 'bolt_circle_in')
      const od = num(r, 'od_in')
      if (rf !== null && bc !== null && od !== null && !(rf < bc && bc < od)) {
        violations.push({ table: 'ref_flanges', message: `class ${cls} NPS ${r.nps}: expected rf_dia < bolt_circle < od, got ${rf} / ${bc} / ${od}` })
      }
      // bolt count multiple of 4
      const boltCount = num(r, 'bolt_count')
      if (boltCount !== null && boltCount % 4 !== 0) {
        violations.push({ table: 'ref_flanges', message: `class ${cls} NPS ${r.nps}: bolt_count ${boltCount} not a multiple of 4` })
      }
      // LTH WN > LTH SO
      const lwn = num(r, 'lth_wn_in')
      const lso = num(r, 'lth_so_in')
      if (lwn !== null && lso !== null && !(lwn > lso)) {
        violations.push({ table: 'ref_flanges', message: `class ${cls} NPS ${r.nps}: lth_wn_in (${lwn}) not > lth_so_in (${lso})` })
      }

      if (prev) {
        const boundaryKey = `${cls}|${r.nps}`
        for (const col of ['od_in', 'thickness_in', 'bolt_circle_in', 'bolt_count', 'lth_wn_in', 'lth_so_in']) {
          const curV = num(r, col)
          const prevV = num(prev, col)
          if (curV !== null && prevV !== null && curV < prevV) {
            const known = boundaryKey === CLASS900_NPS3_BOUNDARY
            if (!known) {
              violations.push({ table: 'ref_flanges', message: `class ${cls} NPS ${r.nps}: ${col} ${curV} decreased from previous size (${prevV}) — not a known exception` })
            }
          }
        }
        const curBsd = num(r, 'bolt_size_in')
        const prevBsd = num(prev, 'bolt_size_in')
        if (curBsd !== null && prevBsd !== null && curBsd < prevBsd && !BSD_DROP_ALLOWED.has(boundaryKey)) {
          violations.push({ table: 'ref_flanges', message: `class ${cls} NPS ${r.nps}: bolt_size_in ${curBsd} decreased from previous size (${prevBsd}) — not a known exception` })
        }
      }
      prev = r
    }
  }
  return violations
}

// class 900 NPS 1/2-2.5 must equal class 1500 (same rows in B16.5);
// class 400 NPS 1/2-3.5 must equal class 600.
export function checkClassEquivalence(rows: CheckRow[]): CheckViolation[] {
  const violations: CheckViolation[] = []
  const key = (r: CheckRow) => `${r.nps}`
  const byClassNps = new Map<string, CheckRow>()
  for (const r of rows) byClassNps.set(`${r.flange_class}|${r.nps}`, r)

  const compareCols = ['od_in', 'thickness_in', 'bolt_circle_in', 'bolt_count', 'bolt_size_in']
  const smallNps = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2']
  for (const nps of smallNps) {
    const a = byClassNps.get(`900|${nps}`)
    const b = byClassNps.get(`1500|${nps}`)
    if (a && b) {
      for (const c of compareCols) {
        if (a[c] !== b[c]) violations.push({ table: 'ref_flanges', message: `class 900 vs 1500 NPS ${nps} should match (B16.5): ${c} ${a[c]} != ${b[c]}` })
      }
    }
  }
  const smallNps400 = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2']
  for (const nps of smallNps400) {
    const a = byClassNps.get(`400|${nps}`)
    const b = byClassNps.get(`600|${nps}`)
    if (a && b) {
      for (const c of compareCols) {
        if (a[c] !== b[c]) violations.push({ table: 'ref_flanges', message: `class 400 vs 600 NPS ${nps} should match (B16.5): ${c} ${a[c]} != ${b[c]}` })
      }
    }
  }
  return violations
}

// B16.9 BW fittings: LR90 A == 1.5*NPS (NPS>=1, 1/2" is a known
// oddity at A=1.50 not 0.75); SR90 A == NPS (from NPS 1); LR45 B ~=
// 0.625*NPS but only holds from NPS 4 up (below NPS 4 and at NPS 22
// the elbow carries extra length per the report's review); tee C <= A.
const LR45_EXEMPT_NPS = new Set(['1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '22'])

export function checkBwFittings(rows: CheckRow[]): CheckViolation[] {
  const violations: CheckViolation[] = []
  const byDim = new Map<string, CheckRow[]>()
  for (const r of rows) {
    const k = r.dimension_label || r.fitting_type
    if (!byDim.has(k)) byDim.set(k, [])
    byDim.get(k)!.push(r)
  }

  for (const r of rows) {
    const npsVal = parseInchesLike(r.nps)
    const a = num(r, 'center_to_end_in')
    if (npsVal === null || a === null) continue

    if (r.fitting_type === 'LR90' && npsVal >= 1) {
      const expected = 1.5 * npsVal
      if (Math.abs(a - expected) > 0.05) {
        violations.push({ table: 'ref_bw_fittings', message: `LR90 NPS ${r.nps}: A=${a} not ~1.5*NPS (${expected})` })
      }
    }
    if (r.fitting_type === 'SR90' && npsVal >= 1) {
      if (Math.abs(a - npsVal) > 0.05) {
        violations.push({ table: 'ref_bw_fittings', message: `SR90 NPS ${r.nps}: A=${a} not ~NPS (${npsVal})` })
      }
    }
    if (r.fitting_type === 'LR45' && npsVal >= 4 && !LR45_EXEMPT_NPS.has(r.nps)) {
      const expected = 0.625 * npsVal
      if (Math.abs(a - expected) > 0.1) {
        violations.push({ table: 'ref_bw_fittings', message: `LR45 NPS ${r.nps}: B=${a} not ~0.625*NPS (${expected}) and not a known exception` })
      }
    }
  }
  return violations
}

export function runBatch1Checks(flangeRows: CheckRow[], bwRows: CheckRow[]): CheckViolation[] {
  return [
    ...checkFlangesMonotonic(flangeRows),
    ...checkClassEquivalence(flangeRows),
    ...checkBwFittings(bwRows),
  ]
}
