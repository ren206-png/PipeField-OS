// ============================================================
// src/lib/turnover/builder.ts
// Assembles all data for a turnover package from the database.
// Returns a strongly-typed TurnoverPackageData object that the
// PDF renderer consumes.  No PDF logic here — pure data.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TurnoverProject {
  id:              string
  name:            string
  project_number:  string | null
  description:     string | null
  governing_code:  string | null
  jurisdiction:    string | null
  unit_system:     string | null
  ahj:             string | null
  page_size:       'letter' | 'A4'
  status:          string | null
}

export interface TurnoverWeld {
  weld_id_number:  string
  spool_number:    string | null
  line_number:     string | null
  pipe_size:       string | null
  weld_process:    string | null
  welder_name:     string | null
  welder_stamp:    string | null
  weld_date:       string | null
  status:          string
  nde_required:    boolean
}

export interface TurnoverNdeRecord {
  weld_id_number:  string
  inspection_type: string
  selection_reason: string
  result:          string | null
  performed_by:    string | null
  report_ref:      string | null
}

export interface TurnoverMtr {
  heat_number:     string
  material_spec:   string | null
  cert_type:       string | null
  cert_type_enum:  string | null
  issued_by:       string | null
  document_url:    string | null
  document_sha256: string | null
}

export interface TurnoverPressureTest {
  test_number:     string | null
  circuit:         string | null
  test_pressure:   number | null
  pressure_unit:   string | null
  test_medium:     string | null
  test_date:       string | null
  result:          string | null
  witnessed_by:    string | null
}

export interface TurnoverSignature {
  role:            string
  signer_name:     string
  signed_at:       string
  content_hash:    string | null
}

export interface TurnoverPackageData {
  package_id:      string
  package_name:    string
  generated_at:    string
  org_name:        string
  project:         TurnoverProject
  welds:           TurnoverWeld[]
  nde_records:     TurnoverNdeRecord[]
  mtrs:            TurnoverMtr[]
  pressure_tests:  TurnoverPressureTest[]
  signatures:      TurnoverSignature[]
  weld_count:      number
  nde_count:       number
  mtr_count:       number
  test_count:      number
}

export async function buildTurnoverPackage(
  supabase: SupabaseClient,
  packageId: string,
  projectId: string,
  orgId: string,
): Promise<TurnoverPackageData> {
  const generatedAt = new Date().toISOString()

  // ── Org name ─────────────────────────────────────────────────
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()
  const orgName = (orgData as { name?: string } | null)?.name ?? 'PipeField OS'

  // ── Package record ────────────────────────────────────────────
  const { data: pkg } = await supabase
    .from('turnover_packages')
    .select('package_name')
    .eq('id', packageId)
    .maybeSingle()
  const packageName = (pkg as { package_name?: string } | null)?.package_name ?? 'Turnover Package'

  // ── Project ───────────────────────────────────────────────────
  const { data: projectRaw } = await supabase
    .from('projects')
    .select('id, name, project_number, description, governing_code, jurisdiction, unit_system, ahj, page_size, status')
    .eq('id', projectId)
    .maybeSingle()

  const project: TurnoverProject = {
    id:             projectRaw?.id ?? projectId,
    name:           (projectRaw as { name?: string } | null)?.name ?? 'Unknown Project',
    project_number: (projectRaw as { project_number?: string } | null)?.project_number ?? null,
    description:    (projectRaw as { description?: string } | null)?.description ?? null,
    governing_code: (projectRaw as { governing_code?: string } | null)?.governing_code ?? null,
    jurisdiction:   (projectRaw as { jurisdiction?: string } | null)?.jurisdiction ?? null,
    unit_system:    (projectRaw as { unit_system?: string } | null)?.unit_system ?? 'imperial',
    ahj:            (projectRaw as { ahj?: string } | null)?.ahj ?? null,
    page_size:      ((projectRaw as { page_size?: string } | null)?.page_size as 'letter' | 'A4') ?? 'letter',
    status:         (projectRaw as { status?: string } | null)?.status ?? null,
  }

  // ── Welds ─────────────────────────────────────────────────────
  const { data: weldsRaw } = await supabase
    .from('welds')
    .select('weld_id_number, spool_number, line_number, pipe_size, weld_process, welder_name, welder_stamp, weld_date, status, nde_required')
    .eq('project_id', projectId)
    .eq('organization_id', orgId)
    .order('weld_id_number', { ascending: true })

  const welds: TurnoverWeld[] = (weldsRaw ?? []).map(w => ({
    weld_id_number: w.weld_id_number,
    spool_number:   w.spool_number,
    line_number:    w.line_number,
    pipe_size:      w.pipe_size,
    weld_process:   w.weld_process,
    welder_name:    w.welder_name,
    welder_stamp:   w.welder_stamp,
    weld_date:      w.weld_date,
    status:         w.status,
    nde_required:   w.nde_required ?? false,
  }))

  // ── NDE records (via nde_plans → nde_selections) ──────────────
  const { data: planIds } = await supabase
    .from('nde_plans')
    .select('id')
    .eq('project_id', projectId)
    .eq('organization_id', orgId)
  const planIdList = (planIds ?? []).map(p => p.id as string)

  let ndeRecords: TurnoverNdeRecord[] = []
  if (planIdList.length > 0) {
    const { data: selectionsRaw } = await supabase
      .from('nde_selections')
      .select('inspection_type, selection_reason, result, performed_by, report_ref, weld:welds(weld_id_number)')
      .in('nde_plan_id', planIdList)
      .order('created_at', { ascending: true })

    ndeRecords = (selectionsRaw ?? []).map(s => {
      const weld = s.weld as { weld_id_number?: string } | null
      return {
        weld_id_number:  weld?.weld_id_number ?? '—',
        inspection_type: s.inspection_type,
        selection_reason: s.selection_reason ?? 'random_sample',
        result:          s.result ?? null,
        performed_by:    s.performed_by ?? null,
        report_ref:      s.report_ref ?? null,
      }
    })
  }

  // ── MTRs ──────────────────────────────────────────────────────
  const { data: mtrsRaw } = await supabase
    .from('mtrs')
    .select('heat_number, material_spec, cert_type, cert_type_enum, issued_by, document_url, document_sha256')
    .eq('project_id', projectId)
    .eq('organization_id', orgId)
    .order('heat_number', { ascending: true })

  const mtrs: TurnoverMtr[] = (mtrsRaw ?? []).map(m => ({
    heat_number:     m.heat_number,
    material_spec:   m.material_spec ?? null,
    cert_type:       m.cert_type ?? null,
    cert_type_enum:  (m as { cert_type_enum?: string }).cert_type_enum ?? null,
    issued_by:       m.issued_by ?? null,
    document_url:    m.document_url ?? null,
    document_sha256: (m as { document_sha256?: string }).document_sha256 ?? null,
  }))

  // ── Pressure tests ─────────────────────────────────────────────
  const { data: testsRaw } = await supabase
    .from('pressure_tests')
    .select('test_number, circuit, test_pressure, pressure_unit, test_medium, test_date, result, witnessed_by')
    .eq('project_id', projectId)
    .eq('organization_id', orgId)
    .order('test_date', { ascending: true })

  const pressureTests: TurnoverPressureTest[] = (testsRaw ?? []).map(t => ({
    test_number:   t.test_number ?? null,
    circuit:       t.circuit ?? null,
    test_pressure: t.test_pressure ?? null,
    pressure_unit: t.pressure_unit ?? 'psi',
    test_medium:   t.test_medium ?? null,
    test_date:     t.test_date ?? null,
    result:        t.result ?? null,
    witnessed_by:  t.witnessed_by ?? null,
  }))

  // ── Signatures ────────────────────────────────────────────────
  const { data: sigsRaw } = await supabase
    .from('signatures')
    .select('role, signer_name, signed_at, content_hash')
    .eq('organization_id', orgId)
    .eq('record_id', projectId)
    .order('signed_at', { ascending: true })

  const signatures: TurnoverSignature[] = (sigsRaw ?? []).map(s => ({
    role:         s.role,
    signer_name:  s.signer_name,
    signed_at:    s.signed_at,
    content_hash: (s as { content_hash?: string }).content_hash ?? null,
  }))

  return {
    package_id:     packageId,
    package_name:   packageName,
    generated_at:   generatedAt,
    org_name:       orgName,
    project,
    welds,
    nde_records:    ndeRecords,
    mtrs,
    pressure_tests: pressureTests,
    signatures,
    weld_count:     welds.length,
    nde_count:      ndeRecords.length,
    mtr_count:      mtrs.length,
    test_count:     pressureTests.length,
  }
}
