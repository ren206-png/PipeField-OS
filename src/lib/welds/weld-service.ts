// ============================================================
// Weld Service — all weld database operations
// Pure async functions — no React, no UI.
// Used by Server Components, Route Handlers, and Server Actions.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import type { Weld, WeldStatus } from '@/types'

// ── Types ────────────────────────────────────────────────────

export interface WeldWithExtras extends Weld {
  project_name?:  string
  spool_number?:  string
  photos?:        WeldPhoto[]
  timeline?:      WeldTimelineEntry[]
}

export interface WeldPhoto {
  id:           string
  weld_id:      string
  storage_path: string
  public_url:   string
  file_name:    string
  file_size:    number | null
  caption:      string | null
  uploaded_by:  string
  created_at:   string
}

export interface WeldTimelineEntry {
  id:              string
  action:          string
  previous_status: string | null
  new_status:      string | null
  performed_by:    string
  performed_by_name?: string
  performed_at:    string
  notes:           string | null
}

export interface WeldFilters {
  projectId?:    string
  status?:       WeldStatus
  welderStamp?:  string
  search?:       string
  page?:         number
  perPage?:      number
}

// ── Queries ──────────────────────────────────────────────────

export async function getWelds(
  organizationId: string,
  filters: WeldFilters = {}
): Promise<{ welds: WeldWithExtras[]; count: number }> {
  const supabase = await createClient()
  const { page = 1, perPage = 25 } = filters
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = supabase
    .from('welds')
    .select(`
      *,
      projects!inner(name),
      spools(spool_number)
    `, { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.projectId)   query = query.eq('project_id',   filters.projectId)
  if (filters.status)      query = query.eq('status',        filters.status)
  if (filters.welderStamp) query = query.ilike('welder_stamp', `%${filters.welderStamp}%`)
  if (filters.search) {
    query = query.or(
      `weld_id_number.ilike.%${filters.search}%,welder_name.ilike.%${filters.search}%,welder_stamp.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw error

  const welds = (data ?? []).map((w: Record<string, unknown>) => ({
    ...(w as object),
    project_name:  (w.projects as { name?: string } | null)?.name ?? '',
    spool_number:  (w.spools  as { spool_number?: string } | null)?.spool_number ?? null,
  })) as WeldWithExtras[]

  return { welds, count: count ?? 0 }
}

export async function getWeld(id: string): Promise<WeldWithExtras | null> {
  const supabase = await createClient()

  // Fetch weld + related data
  const { data: weld, error } = await supabase
    .from('welds')
    .select(`*, projects(name), spools(spool_number)`)
    .eq('id', id)
    .single()

  if (error || !weld) return null

  // Fetch photos
  const { data: photos } = await supabase
    .from('weld_photos')
    .select('*')
    .eq('weld_id', id)
    .order('created_at', { ascending: true })

  // Fetch audit timeline for this weld
  const { data: auditRows } = await supabase
    .from('audit_logs')
    .select(`*, user_profiles(full_name)`)
    .eq('table_name', 'welds')
    .eq('record_id', id)
    .order('performed_at', { ascending: false })

  const timeline: WeldTimelineEntry[] = (auditRows ?? []).map((row: Record<string, unknown>) => ({
    id:               row.id as string,
    action:           row.action as string,
    previous_status:  (row.previous_values as Record<string, unknown> | null)?.status as string ?? null,
    new_status:       (row.new_values      as Record<string, unknown> | null)?.status as string ?? null,
    performed_by:     row.performed_by as string,
    performed_by_name:(row.user_profiles as { full_name?: string } | null)?.full_name ?? 'Unknown',
    performed_at:     row.performed_at as string,
    notes:            (row.new_values   as Record<string, unknown> | null)?.notes as string ?? null,
  }))

  const w = weld as Record<string, unknown>
  return {
    ...(w as object),
    project_name:  (w.projects as { name?: string } | null)?.name ?? '',
    spool_number:  (w.spools   as { spool_number?: string } | null)?.spool_number ?? null,
    photos:        (photos ?? []) as WeldPhoto[],
    timeline,
  } as WeldWithExtras
}

// ── Create ───────────────────────────────────────────────────

export interface CreateWeldInput {
  organization_id: string
  project_id:      string
  spool_id?:       string
  weld_id_number:  string
  welder_stamp?:   string
  welder_name?:    string
  weld_date?:      string
  notes?:          string
  created_by:      string
}

export async function createWeld(input: CreateWeldInput): Promise<Weld> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('welds')
    .insert({
      organization_id: input.organization_id,
      project_id:      input.project_id,
      spool_id:        input.spool_id    ?? null,
      weld_id_number:  input.weld_id_number,
      welder_stamp:    input.welder_stamp ?? null,
      welder_name:     input.welder_name  ?? null,
      weld_date:       input.weld_date    ?? null,
      notes:           input.notes        ?? null,
      status:          'draft',
      created_by:      input.created_by,
    })
    .select()
    .single()

  if (error) throw error

  // Write audit log
  await writeAuditLog({
    organization_id: input.organization_id,
    table_name:      'welds',
    record_id:       (data as { id: string }).id,
    action:          'INSERT',
    previous_values: null,
    new_values:      { status: 'draft', ...input },
    performed_by:    input.created_by,
  })

  return data as Weld
}

// ── Update Status ─────────────────────────────────────────────

export async function updateWeldStatus(
  weldId:         string,
  newStatus:      WeldStatus,
  performedBy:    string,
  organizationId: string,
  notes?:         string
): Promise<Weld> {
  const supabase = await createClient()

  // Get current state for audit
  const { data: current } = await supabase
    .from('welds')
    .select('status, notes')
    .eq('id', weldId)
    .single()

  const { data, error } = await supabase
    .from('welds')
    .update({ status: newStatus, notes: notes ?? (current as { notes?: string } | null)?.notes })
    .eq('id', weldId)
    .select()
    .single()

  if (error) throw error

  // Write audit log
  await writeAuditLog({
    organization_id: organizationId,
    table_name:      'welds',
    record_id:       weldId,
    action:          'UPDATE',
    previous_values: { status: (current as { status?: string } | null)?.status },
    new_values:      { status: newStatus, notes },
    performed_by:    performedBy,
  })

  return data as Weld
}

// ── Update Weld (general) ─────────────────────────────────────

export interface UpdateWeldInput {
  welder_stamp?: string
  welder_name?:  string
  weld_date?:    string
  notes?:        string
  spool_id?:     string | null
}

export async function updateWeld(
  weldId:         string,
  input:          UpdateWeldInput,
  performedBy:    string,
  organizationId: string
): Promise<Weld> {
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('welds')
    .select('*')
    .eq('id', weldId)
    .single()

  const { data, error } = await supabase
    .from('welds')
    .update(input)
    .eq('id', weldId)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    organization_id: organizationId,
    table_name:      'welds',
    record_id:       weldId,
    action:          'UPDATE',
    previous_values: current as Record<string, unknown>,
    new_values:      input   as Record<string, unknown>,
    performed_by:    performedBy,
  })

  return data as Weld
}

// ── Photo Upload ──────────────────────────────────────────────

export async function uploadWeldPhoto(
  weldId:         string,
  organizationId: string,
  uploadedBy:     string,
  file:           File
): Promise<WeldPhoto> {
  const supabase = await createClient()

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${organizationId}/${weldId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('weld-photos')
    .upload(path, file, { upsert: false })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('weld-photos')
    .getPublicUrl(path)

  const { data, error } = await supabase
    .from('weld_photos')
    .insert({
      weld_id:         weldId,
      organization_id: organizationId,
      storage_path:    path,
      public_url:      publicUrl,
      file_name:       file.name,
      file_size:       file.size,
      uploaded_by:     uploadedBy,
    })
    .select()
    .single()

  if (error) throw error
  return data as WeldPhoto
}

export async function deleteWeldPhoto(photoId: string, storagePath: string): Promise<void> {
  const supabase = await createClient()
  await supabase.storage.from('weld-photos').remove([storagePath])
  await supabase.from('weld_photos').delete().eq('id', photoId)
}

// ── Audit log helper ──────────────────────────────────────────

async function writeAuditLog(entry: {
  organization_id: string
  table_name:      string
  record_id:       string
  action:          string
  previous_values: Record<string, unknown> | null
  new_values:      Record<string, unknown> | null
  performed_by:    string
}) {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert(entry)
  } catch {
    // Never let audit failures break the main operation
  }
}

// ── Auto-generate next weld ID ────────────────────────────────

export async function getNextWeldId(projectId: string): Promise<string> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('welds')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
  const next = (count ?? 0) + 1
  return `W-${String(next).padStart(4, '0')}`
}
