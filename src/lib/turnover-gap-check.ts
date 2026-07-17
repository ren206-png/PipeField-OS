import { SupabaseClient } from '@supabase/supabase-js'

export interface GapReport {
  total_welds: number
  welds_without_status: number         // status = 'pending' or 'in_progress'
  welds_without_welder: number         // welder_id IS NULL
  welds_without_wps: number            // wps_number IS NULL or ''
  welds_with_open_nde: number          // nde_selections with result='pending' for this project
  welds_with_qual_flags: number        // qualification_flag IS NOT NULL
  mtrs_missing: number                 // welds with heat_a/b set but no matching MTR in mtr_documents
  has_blocking_gaps: boolean           // true if any gap > 0
  gaps: { field: string; count: number; severity: 'error' | 'warning' }[]
}

export async function runGapCheck(
  supabase: SupabaseClient,
  projectId: string,
  organizationId: string
): Promise<GapReport> {
  // Query welds for this project
  const { data: welds, error } = await supabase
    .from('welds')
    .select('id, status, welder_id, wps_number, base_metal_heat_a, base_metal_heat_b, qualification_flag')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)

  if (error) throw error
  const allWelds = welds ?? []

  const weldsWithoutStatus = allWelds.filter(w =>
    !w.status || w.status === 'pending' || w.status === 'in_progress'
  ).length

  const weldsWithoutWelder = allWelds.filter(w => !w.welder_id).length
  const weldsWithoutWps = allWelds.filter(w => !w.wps_number).length
  const weldsWithQualFlags = allWelds.filter(w => w.qualification_flag).length

  // Open NDE: check nde_selections for pending results on any plan for this project
  const { count: openNde } = await supabase
    .from('nde_selections')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('result', 'pending')
    .in('nde_plan_id',
      // subquery workaround: get plan IDs for this project
      (await supabase.from('nde_plans').select('id').eq('project_id', projectId).eq('organization_id', organizationId)).data?.map(p => p.id) ?? []
    )

  // MTR check: welds with heat numbers but no MTR document
  const heatNumbers = new Set<string>()
  allWelds.forEach(w => {
    if (w.base_metal_heat_a) heatNumbers.add(w.base_metal_heat_a)
    if (w.base_metal_heat_b) heatNumbers.add(w.base_metal_heat_b)
  })

  let mtrsMissing = 0
  if (heatNumbers.size > 0) {
    const { data: mtrs } = await supabase
      .from('mtr_documents')
      .select('heat_number')
      .eq('organization_id', organizationId)
      .in('heat_number', Array.from(heatNumbers))
    const foundHeats = new Set((mtrs ?? []).map(m => m.heat_number))
    mtrsMissing = Array.from(heatNumbers).filter(h => !foundHeats.has(h)).length
  }

  const gaps: GapReport['gaps'] = []
  if (weldsWithoutStatus > 0)
    gaps.push({ field: 'Incomplete welds (pending/in-progress)', count: weldsWithoutStatus, severity: 'error' })
  if (weldsWithQualFlags > 0)
    gaps.push({ field: 'Open qualification flags', count: weldsWithQualFlags, severity: 'error' })
  if ((openNde ?? 0) > 0)
    gaps.push({ field: 'Pending NDE results', count: openNde ?? 0, severity: 'error' })
  if (weldsWithoutWelder > 0)
    gaps.push({ field: 'Welds without welder assigned', count: weldsWithoutWelder, severity: 'warning' })
  if (weldsWithoutWps > 0)
    gaps.push({ field: 'Welds without WPS number', count: weldsWithoutWps, severity: 'warning' })
  if (mtrsMissing > 0)
    gaps.push({ field: 'Heat numbers without MTR documents', count: mtrsMissing, severity: 'warning' })

  return {
    total_welds: allWelds.length,
    welds_without_status: weldsWithoutStatus,
    welds_without_welder: weldsWithoutWelder,
    welds_without_wps: weldsWithoutWps,
    welds_with_open_nde: openNde ?? 0,
    welds_with_qual_flags: weldsWithQualFlags,
    mtrs_missing: mtrsMissing,
    has_blocking_gaps: gaps.some(g => g.severity === 'error'),
    gaps,
  }
}
