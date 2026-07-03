// ============================================================
// Spool Service — all DB operations for spools & spool items
// Server-side only (uses next/headers via createClient)
// ============================================================
import { createClient } from '@/lib/supabase/server'
import type { Spool, SpoolItem, SpoolStatus } from '@/types'

// ── Types ────────────────────────────────────────────────────

export interface SpoolWithExtras extends Spool {
  project?:     { name: string }
  spool_items?: SpoolItem[]
  weld_count?:  number
}

export interface SpoolFilters {
  projectId?: string
  status?:    SpoolStatus
  search?:    string
  page?:      number
}

export interface CreateSpoolInput {
  organization_id: string
  project_id:      string
  spool_number:    string
  revision?:       string
  pipe_size?:      string
  pipe_schedule?:  string
  material?:       string
  service?:        string
  design_pressure?: number
  design_temp?:    number
  total_length_in?: number
  isometric_ref?:  string
  area?:           string
  priority?:       number
  notes?:          string
  required_date?:  string
  created_by:      string
}

export interface UpdateSpoolInput {
  spool_number?:   string
  revision?:       string
  pipe_size?:      string
  pipe_schedule?:  string
  material?:       string
  service?:        string
  design_pressure?: number | null
  design_temp?:    number | null
  total_length_in?: number | null
  isometric_ref?:  string | null
  area?:           string | null
  priority?:       number
  notes?:          string | null
  required_date?:  string | null
}

// ── List spools ──────────────────────────────────────────────

export async function getSpools(
  orgId: string,
  filters: SpoolFilters = {}
): Promise<{ spools: SpoolWithExtras[]; count: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('spools')
    .select('*, projects(name)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('priority', { ascending: true })
    .order('spool_number', { ascending: true })

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.status)    query = query.eq('status', filters.status)
  if (filters.search)    query = query.or(
    `spool_number.ilike.%${filters.search}%,area.ilike.%${filters.search}%,isometric_ref.ilike.%${filters.search}%`
  )

  const from = ((filters.page ?? 1) - 1) * 25
  query = query.range(from, from + 24)

  const { data, error, count } = await query
  if (error) throw error

  return { spools: (data ?? []) as SpoolWithExtras[], count: count ?? 0 }
}

// ── Single spool with items ───────────────────────────────────

export async function getSpool(id: string): Promise<SpoolWithExtras | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('spools')
    .select('*, projects(name), spool_items(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  // Get weld count for this spool
  const { count: weldCount } = await supabase
    .from('welds')
    .select('id', { count: 'exact', head: true })
    .eq('spool_number', (data as unknown as { spool_number: string }).spool_number)
    .eq('project_id',   (data as unknown as { project_id: string }).project_id)

  return { ...(data as unknown as SpoolWithExtras), weld_count: weldCount ?? 0 }
}

// ── Create spool ─────────────────────────────────────────────

export async function createSpool(input: CreateSpoolInput): Promise<Spool> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('spools')
    .insert({
      organization_id: input.organization_id,
      project_id:      input.project_id,
      spool_number:    input.spool_number.toUpperCase(),
      revision:        input.revision        ?? 'A',
      status:          'designed',
      pipe_size:       input.pipe_size       ?? null,
      pipe_schedule:   input.pipe_schedule   ?? null,
      material:        input.material        ?? null,
      service:         input.service         ?? null,
      design_pressure: input.design_pressure ?? null,
      design_temp:     input.design_temp     ?? null,
      total_length_in: input.total_length_in ?? null,
      isometric_ref:   input.isometric_ref   ?? null,
      area:            input.area            ?? null,
      priority:        input.priority        ?? 5,
      notes:           input.notes           ?? null,
      required_date:   input.required_date   ?? null,
      created_by:      input.created_by,
    })
    .select()
    .single()

  if (error) throw error

  // Audit log
  await writeAuditLog({
    organization_id: input.organization_id,
    record_id:       (data as unknown as { id: string }).id,
    action:          'INSERT',
    new_status:      'designed',
    performed_by:    input.created_by,
    notes:           'Spool created',
  })

  return data as unknown as Spool
}

// ── Update spool status ───────────────────────────────────────

export async function updateSpoolStatus(
  spoolId:     string,
  newStatus:   SpoolStatus,
  performedBy: string,
  orgId:       string,
  notes?:      string
): Promise<void> {
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('spools')
    .select('status')
    .eq('id', spoolId)
    .single()

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'released') updateData.released_date = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('spools')
    .update(updateData)
    .eq('id', spoolId)

  if (error) throw error

  await writeAuditLog({
    organization_id: orgId,
    record_id:       spoolId,
    action:          'UPDATE',
    previous_status: (current as unknown as { status?: string } | null)?.status,
    new_status:      newStatus,
    performed_by:    performedBy,
    notes,
  })
}

// ── Update spool details ──────────────────────────────────────

export async function updateSpool(
  spoolId:     string,
  input:       UpdateSpoolInput,
  performedBy: string,
  orgId:       string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('spools')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', spoolId)

  if (error) throw error

  await writeAuditLog({
    organization_id: orgId,
    record_id:       spoolId,
    action:          'UPDATE',
    performed_by:    performedBy,
    notes:           'Spool details updated',
  })
}

// ── Spool items ───────────────────────────────────────────────

export async function addSpoolItem(
  spoolId: string,
  orgId:   string,
  item: Omit<SpoolItem, 'id' | 'spool_id' | 'organization_id' | 'created_at'>
): Promise<SpoolItem> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('spool_items')
    .insert({ ...item, spool_id: spoolId, organization_id: orgId })
    .select()
    .single()

  if (error) throw error
  return data as unknown as SpoolItem
}

export async function updateSpoolItem(
  itemId: string,
  updates: Partial<Pick<SpoolItem, 'is_cut' | 'is_fitted' | 'heat_number' | 'notes' | 'quantity' | 'length_in'>>
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('spool_items').update(updates).eq('id', itemId)
  if (error) throw error
}

export async function deleteSpoolItem(itemId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('spool_items').delete().eq('id', itemId)
  if (error) throw error
}

// ── Private helpers ───────────────────────────────────────────

async function writeAuditLog(entry: {
  organization_id: string
  record_id:       string
  action:          'INSERT' | 'UPDATE' | 'DELETE'
  previous_status?: string
  new_status?:     string
  performed_by:    string
  notes?:          string
}): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      organization_id:  entry.organization_id,
      table_name:       'spools',
      record_id:        entry.record_id,
      action:           entry.action,
      previous_values:  entry.previous_status ? { status: entry.previous_status } : null,
      new_values:       entry.new_status      ? { status: entry.new_status }      : null,
      performed_by:     entry.performed_by,
      notes:            entry.notes ?? null,
    })
  } catch {
    // Audit failures never break the main operation
  }
}
