// src/intelligence/engines/qualification-engine.ts
// Deterministic welder qualification + continuity checker.
// All range comparisons use tenant-configured WPS data.
// ENGINEERING_REVIEW_REQUIRED: this engine does not interpret code text.
// It checks ranges as entered by the tenant. Verify all WPS ranges
// against your governing code before activating QUAL_ENFORCEMENT.

import { createAdminClient } from '@/lib/supabase/admin'

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
