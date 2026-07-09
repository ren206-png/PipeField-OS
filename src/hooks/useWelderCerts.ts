'use client'
import { apiFetch } from '@/lib/apiFetch'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface WelderCert {
  id: string
  welder_id: string
  cert_type: string
  cert_number: string | null
  cert_processes: string[] | null
  cert_positions: string[] | null
  issued_date: string | null
  expiry_date: string
  issued_by: string | null
  notes: string | null
  is_active: boolean
  welders?: { full_name: string; stamp: string }
}

export function useWelderCerts(welderId?: string) {
  return useQuery<WelderCert[]>({
    queryKey: ['welder-certs', welderId],
    queryFn: () => fetch(`/api/welders/certifications${welderId ? `?welderId=${welderId}` : ''}`).then(r => r.json()),
  })
}

export function useExpiringCerts(days = 30) {
  return useQuery<WelderCert[]>({
    queryKey: ['expiring-certs', days],
    queryFn: () => fetch(`/api/welders/certifications/expiring?days=${days}`).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAddWelderCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<WelderCert, 'id' | 'is_active' | 'welders'>) =>
      apiFetch('/api/welders/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['welder-certs'] })
      qc.invalidateQueries({ queryKey: ['expiring-certs'] })
    },
  })
}
