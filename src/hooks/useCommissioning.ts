'use client'
// ============================================================
// useCommissioning — React Query hooks for commissioning module
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from './useOrganization'

export interface SystemTurnoverPackage {
  id: string
  organization_id: string
  project_id: string
  stp_number: string
  system_name: string
  system_description: string | null
  discipline: string | null
  status: 'not_started' | 'pre_comm_in_progress' | 'pre_comm_complete' | 'comm_in_progress' | 'comm_complete' | 'accepted'
  pre_comm_target_date: string | null
  comm_target_date: string | null
  handover_date: string | null
  responsible_engineer: string | null
  client_rep: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  precomm_items?: PrecommItem[]
  handover_certificates?: HandoverCertificate[]
}

export interface PrecommItem {
  id: string
  organization_id: string
  stp_id: string
  sequence_no: number
  activity: string
  description: string | null
  discipline: string | null
  responsible_party: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'na' | 'rejected'
  completed_by: string | null
  completed_date: string | null
  verified_by: string | null
  verified_date: string | null
  comments: string | null
  created_at: string
  updated_at: string
}

export interface HandoverCertificate {
  id: string
  organization_id: string
  stp_id: string
  cert_number: string
  cert_type: 'mechanical_completion' | 'pre_commissioning' | 'commissioning' | 'performance_test' | 'final_acceptance'
  issued_date: string | null
  accepted_date: string | null
  contractor_rep: string | null
  client_rep: string | null
  notes: string | null
  status: 'draft' | 'issued' | 'accepted' | 'rejected'
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── List STPs for a project ───────────────────────────────────
export function useStps(projectId: string | null) {
  const supabase = createClient()
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['stps', organizationId, projectId],
    enabled: !!organizationId && !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_turnover_packages')
        .select(`
          *,
          precomm_items(id, status),
          handover_certificates(id, status, cert_type)
        `)
        .eq('organization_id', organizationId!)
        .eq('project_id', projectId!)
        .order('stp_number')
      if (error) throw error
      return data as SystemTurnoverPackage[]
    },
  })
}

// ── Single STP with full detail ───────────────────────────────
export function useStp(id: string | null) {
  const supabase = createClient()
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['stp', id],
    enabled: !!id && !!organizationId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_turnover_packages')
        .select(`
          *,
          precomm_items(*),
          handover_certificates(*)
        `)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('STP not found')
      // Sort items by sequence_no
      if (data.precomm_items) {
        data.precomm_items.sort((a: PrecommItem, b: PrecommItem) => a.sequence_no - b.sequence_no)
      }
      return data as SystemTurnoverPackage
    },
  })
}

// ── Create STP ───────────────────────────────────────────────
export function useCreateStp() {
  const supabase = createClient()
  const { organizationId } = useOrganization()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      project_id: string
      stp_number: string
      system_name: string
      system_description?: string
      discipline?: string
      responsible_engineer?: string
      pre_comm_target_date?: string
      comm_target_date?: string
    }) => {
      const { data, error } = await supabase
        .from('system_turnover_packages')
        .insert({ organization_id: organizationId, ...values })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stps', organizationId, data.project_id] })
    },
  })
}

// ── Update STP status ────────────────────────────────────────
export function useUpdateStp() {
  const supabase = createClient()
  const { organizationId } = useOrganization()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<SystemTurnoverPackage> & { id: string }) => {
      const { error } = await supabase
        .from('system_turnover_packages')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stp', vars.id] })
      qc.invalidateQueries({ queryKey: ['stps'] })
    },
  })
}

// ── Precomm item mutations ────────────────────────────────────
export function useCreatePrecommItem() {
  const supabase = createClient()
  const { organizationId } = useOrganization()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (values: Omit<PrecommItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('precomm_items')
        .insert({ organization_id: organizationId, ...values })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stp', data.stp_id] })
    },
  })
}

export function useUpdatePrecommItem() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, stp_id, ...values }: Partial<PrecommItem> & { id: string; stp_id: string }) => {
      const { error } = await supabase
        .from('precomm_items')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      return { id, stp_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stp', data.stp_id] })
    },
  })
}

export function useDeletePrecommItem() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, stp_id }: { id: string; stp_id: string }) => {
      const { error } = await supabase.from('precomm_items').delete().eq('id', id)
      if (error) throw error
      return { stp_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stp', data.stp_id] })
    },
  })
}

// ── Handover certificate mutations ────────────────────────────
export function useCreateCertificate() {
  const supabase = createClient()
  const { organizationId } = useOrganization()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (values: Omit<HandoverCertificate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('handover_certificates')
        .insert({ organization_id: organizationId, ...values })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stp', data.stp_id] })
    },
  })
}

export function useUpdateCertificate() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, stp_id, ...values }: Partial<HandoverCertificate> & { id: string; stp_id: string }) => {
      const { error } = await supabase
        .from('handover_certificates')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      return { stp_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stp', data.stp_id] })
    },
  })
}
