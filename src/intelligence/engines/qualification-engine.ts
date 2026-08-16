// src/intelligence/engines/qualification-engine.ts
// Deterministic welder qualification + continuity checker.
// All range comparisons use tenant-configured WPS data.
// ENGINEERING_REVIEW_REQUIRED: this engine does not interpret code text.
// It checks ranges as entered by the tenant. Verify all WPS ranges
// against your governing code before activating QUAL_ENFORCEMENT.
//
// Sprint 3 additions:
//   checkQualificationV2() — essential variable expansion (position coverage,
//   P-number grouping, thickness/OD range, continuity). Requires the new
//   columns added in 20260815_welder_qual_essential_vars.sql.
//   Original checkQualification() is preserved unchanged for backwards compat.

import { createAdminClient } from '@/lib/supabase/admin'
import { pNumberCovers } from '@/intelligence/p-number-coverage'
import { FLAGS } from '@/intelligence/flags'

export interface QualificationCheckInput {
  weldId:         string
  welderId:       string | null   // null if welder_id not set on weld
  welderStamp:    string | null
  wpsId:          string | null
  organizationId: string
}

export interface QualificationResult {
  qualified:          boolean
  qualReason:         string
  certId:             string | null   // cert used if qualified
  certExpiry:         string | null
  continuityOk:       boolean
  continuityReason:   string
  engineeringNote:    string  // always rendered in UI
}

export async function checkQualification(
  input: QualificationCheckInput,
): Promise<QualificationResult> {
  const ENGINEERING_NOTE =
    '⚠️ ENGINEERING_REVIEW_REQUIRED: Qualification ranges come from your WPS records ' +
    'as entered in PipeField OS. Verify all parameters against your governing code and ' +
    'client specification before relying on this check for compliance.'

  const admin = createAdminClient()

  // If no welder_id set, cannot check
  if (!input.welderId) {
    return {
      qualified: false,
      qualReason: 'No welder linked to this weld (welder_id not set). Assign a welder before qualification can be checked.',
      certId: null, certExpiry: null,
      continuityOk: false,
      continuityReason: 'Cannot check continuity without a linked welder.',
      engineeringNote: ENGINEERING_NOTE,
    }
  }

  // Get WPS details if provided
  let wpsProcess: string | null = null
  let wpsPositions: string[] = []

  if (input.wpsId) {
    const { data: wps } = await admin
      .from('wps_records')
      .select('process, position, thickness_min_in, thickness_max_in')
      .eq('id', input.wpsId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()

    if (wps) {
      wpsProcess = wps.process as string
      wpsPositions = wps.position ? [(wps.position as string)] : []
    }
  }

  // Find active certs for this welder
  const { data: certs } = await admin
    .from('welder_certifications')
    .select('id, cert_processes, cert_positions, expiry_date, is_active')
    .eq('welder_id', input.welderId)
    .eq('organization_id', input.organizationId)
    .eq('is_active', true)
    .gt('expiry_date', new Date().toISOString())

  if (!certs || certs.length === 0) {
    return {
      qualified: false,
      qualReason: 'No active, non-expired certifications found for this welder.',
      certId: null, certExpiry: null,
      continuityOk: false,
      continuityReason: 'Cannot verify continuity without active cert.',
      engineeringNote: ENGINEERING_NOTE,
    }
  }

  // Check if any cert covers the WPS process and position
  let matchedCert: typeof certs[0] | null = null

  for (const cert of certs) {
    const processes = cert.cert_processes as string[] ?? []
    const positions = cert.cert_positions as string[] ?? []

    const processOk = !wpsProcess || processes.includes(wpsProcess)
    const positionOk = wpsPositions.length === 0 || wpsPositions.some(p => positions.includes(p))

    if (processOk && positionOk) {
      matchedCert = cert
      break
    }
  }

  if (!matchedCert) {
    return {
      qualified: false,
      qualReason: `No active cert covers process "${wpsProcess ?? 'unknown'}" / position "${wpsPositions.join(',') || 'any'}".`,
      certId: null, certExpiry: null,
      continuityOk: false,
      continuityReason: 'Qualification failed — continuity check skipped.',
      engineeringNote: ENGINEERING_NOTE,
    }
  }

  // Continuity check: find most recent weld by this welder within the window
  const { data: orgSettings } = await admin
    .from('org_settings')
    .select('continuity_window_hours')
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  const windowHours = Number((orgSettings as { continuity_window_hours?: number } | null)?.continuity_window_hours ?? 6)
  const windowMs = windowHours * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - windowMs).toISOString()

  // Look for the welder's most recent weld to establish continuity
  const { data: recentWelds } = await admin
    .from('welds')
    .select('id, weld_date, created_at')
    .eq('organization_id', input.organizationId)
    .eq('welder_id', input.welderId)
    .neq('id', input.weldId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  const continuityOk = (recentWelds ?? []).length > 0
  const continuityReason = continuityOk
    ? `Continuity established — welder has activity within ${windowHours}h window.`
    : `No weld activity found within ${windowHours}h window (ENGINEERING_REVIEW_REQUIRED: window configured in org settings).`

  return {
    qualified: true,
    qualReason: `Qualified via cert ${matchedCert.id} (expires ${matchedCert.expiry_date}).`,
    certId: matchedCert.id as string,
    certExpiry: matchedCert.expiry_date as string,
    continuityOk,
    continuityReason,
    engineeringNote: ENGINEERING_NOTE,
  }
}

// ============================================================
// checkQualificationV2 — essential variable expansion
// Sprint 3 / ARCH_PLAN.md Sprint 3.
//
// ENGINEERING_REVIEW_REQUIRED (RULE-001, RULE-002, RULE-003):
// Position coverage, P-number grouping, and thickness range rules
// must be verified by a licensed engineer before enabling
// PFOS_QUAL_ENFORCEMENT in production.
// ============================================================

export interface QualificationCheckV2Input {
  welderId:          string
  organizationId:    string
  weldId:            string
  /** Welding process required, e.g. 'SMAW', 'GTAW' */
  process:           string
  /** Position required, e.g. '3G', '6G' */
  position:          string
  /** Base metal P-number, e.g. 'P1', 'P8' (optional) */
  pNumber?:          string
  /** Actual pipe wall thickness in inches (optional) */
  wallThickness_in?: number
  /** Actual pipe OD in inches (optional) */
  od_in?:            number
  /** Whether weld requires PWHT (optional) */
  requiresPwht?:     boolean
}

export interface QualificationResultV2 {
  qualified:        boolean
  reason:           string
  certId:           string | null
  certExpiry:       string | null
  continuityOk:     boolean
  continuityReason: string
  checksRun:        string[]
  engineeringNote:  string
}

// Explicit shape for the new columns not yet in Supabase generated types
interface CertV2Row {
  id:                   string
  cert_processes:       string[] | null
  cert_positions:       string[] | null
  expiry_date:          string
  p_number_base:        string | null
  thickness_min_in:     number | null
  thickness_max_in:     number | null
  od_min_in:            number | null
  pwht_condition:       string | null
  continuity_last_date: string | null
  standard:             string | null
}

export async function checkQualificationV2(
  input: QualificationCheckV2Input,
): Promise<QualificationResultV2> {
  const ENGINEERING_NOTE =
    '⚠️ ENGINEERING_REVIEW_REQUIRED (RULE-001, RULE-002, RULE-003): ' +
    'Position coverage, P-number grouping, and thickness ranges must be ' +
    'verified against your governing code before relying on V2 checks for compliance.'

  const checksRun: string[] = []
  const admin = createAdminClient()

  // ── 1. Fetch active, non-expired certs ───────────────────────
  checksRun.push('cert_active_expiry')
  const { data: certsRaw } = await admin
    .from('welder_certifications')
    .select(
      'id, cert_processes, cert_positions, expiry_date, ' +
      'p_number_base, thickness_min_in, thickness_max_in, od_min_in, ' +
      'pwht_condition, continuity_last_date, standard'
    )
    .eq('welder_id', input.welderId)
    .eq('organization_id', input.organizationId)
    .eq('is_active', true)
    .gt('expiry_date', new Date().toISOString())

  // Cast to explicit shape since new columns are not yet in generated Supabase types
  const certs = (certsRaw ?? []) as unknown as CertV2Row[]

  if (certs.length === 0) {
    return {
      qualified: false, reason: 'No active, non-expired certifications found.',
      certId: null, certExpiry: null, continuityOk: false,
      continuityReason: 'Cannot verify continuity without an active cert.',
      checksRun, engineeringNote: ENGINEERING_NOTE,
    }
  }

  // ── 2. Fetch position coverage for required position ─────────
  checksRun.push('position_coverage')
  const { data: coverage } = await admin
    .from('position_coverage')
    .select('tested_position, covers')
    .eq('standard', 'ASME IX')

  const coverageMap = new Map((coverage ?? []).map(r => [
    r.tested_position as string,
    r.covers as string[]
  ]))

  // ── 3. Match cert ─────────────────────────────────────────────
  let matchedCert: CertV2Row | null = null

  for (const cert of certs) {
    const processes = cert.cert_processes as string[] ?? []
    const positions = cert.cert_positions as string[] ?? []

    // Process — exact match
    if (!processes.includes(input.process)) continue
    checksRun.push(`process_match:${cert.id}`)

    // Position — expanded via coverage table
    const positionCovered = positions.some(tested => {
      const covers = coverageMap.get(tested) ?? [tested]
      return covers.includes(input.position)
    })
    if (!positionCovered) continue
    checksRun.push(`position_coverage_match:${cert.id}`)

    // Thickness range (if provided and cert has range)
    if (input.wallThickness_in !== undefined && cert.thickness_min_in && cert.thickness_max_in) {
      checksRun.push(`thickness_range:${cert.id}`)
      if (input.wallThickness_in < (cert.thickness_min_in as number)) continue
      if (input.wallThickness_in > (cert.thickness_max_in as number)) continue
    }

    // OD minimum (if provided and cert has OD min)
    if (input.od_in !== undefined && cert.od_min_in) {
      checksRun.push(`od_min:${cert.id}`)
      if (input.od_in < (cert.od_min_in as number)) continue
    }

    // P-number coverage (if provided and cert has P-number)
    if (input.pNumber && cert.p_number_base) {
      checksRun.push(`p_number:${cert.id}`)
      if (!pNumberCovers(cert.p_number_base as string, input.pNumber)) continue
    }

    // PWHT condition
    if (input.requiresPwht !== undefined && cert.pwht_condition) {
      checksRun.push(`pwht_condition:${cert.id}`)
      const cond = cert.pwht_condition as string
      if (input.requiresPwht && cond === 'as_welded') continue
      if (!input.requiresPwht && cond === 'pwht') continue
    }

    matchedCert = cert
    break
  }

  if (!matchedCert) {
    return {
      qualified: false,
      reason: `No cert covers process "${input.process}" / position "${input.position}" with the specified essential variables.`,
      certId: null, certExpiry: null, continuityOk: false,
      continuityReason: 'Qualification failed — continuity skipped.',
      checksRun, engineeringNote: ENGINEERING_NOTE,
    }
  }

  // ── 4. Continuity check (QW-322, 180-day default) ────────────
  let continuityOk = true
  let continuityReason = 'Continuity check skipped (flag off or no date recorded).'

  if (FLAGS.PFOS_QUAL_ENFORCEMENT && matchedCert.continuity_last_date) {
    checksRun.push('continuity_qw322')
    const { data: orgSettings } = await admin
      .from('org_settings')
      .select('continuity_window_hours')
      .eq('organization_id', input.organizationId)
      .maybeSingle()

    const windowDays = Math.round(
      (Number((orgSettings as { continuity_window_hours?: number } | null)?.continuity_window_hours ?? 4320)) / 24
    )
    const lastDate = new Date(matchedCert.continuity_last_date as string)
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)

    if (daysSince > windowDays) {
      continuityOk = false
      continuityReason = `Continuity lapsed: last qualifying weld was ${daysSince}d ago (limit: ${windowDays}d per QW-322).`
    } else {
      continuityReason = `Continuity OK: last qualifying weld was ${daysSince}d ago (limit: ${windowDays}d).`
    }
  }

  return {
    qualified: continuityOk || !FLAGS.PFOS_QUAL_ENFORCEMENT,
    reason: continuityOk
      ? `Qualified via cert ${matchedCert.id} (expires ${matchedCert.expiry_date}).`
      : `Cert matches but continuity lapsed — ${continuityReason}`,
    certId:          matchedCert.id as string,
    certExpiry:      matchedCert.expiry_date as string,
    continuityOk,
    continuityReason,
    checksRun,
    engineeringNote: ENGINEERING_NOTE,
  }
}
