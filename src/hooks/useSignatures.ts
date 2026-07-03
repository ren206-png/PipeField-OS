'use client'
// ============================================================
// useSignatures — fetch and create signatures for a record
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ────────────────────────────────────────────────────
export interface Signature {
  id:             string
  organization_id: string
  record_type:    string
  record_id:      string
  role:           string
  signer_name:    string
  signer_title:   string | null
  signature_data: string
  signed_at:      string
  signed_by:      string | null
}

export interface CreateSignatureInput {
  recordType:    string
  recordId:      string
  role:          string
  signerName:    string
  signerTitle?:  string
  signatureData: string
}

// ── Fetch helpers ────────────────────────────────────────────
async function fetchSignatures(recordType: string, recordId: string): Promise<Signature[]> {
  const res = await fetch(`/api/signatures/${encodeURIComponent(recordType)}/${encodeURIComponent(recordId)}`)
  if (!res.ok) throw new Error('Failed to fetch signatures')
  const json = await res.json() as { signatures: Signature[] }
  return json.signatures
}

async function createSignature(input: CreateSignatureInput): Promise<Signature> {
  const res = await fetch('/api/signatures', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      recordType:    input.recordType,
      recordId:      input.recordId,
      role:          input.role,
      signerName:    input.signerName,
      signerTitle:   input.signerTitle ?? null,
      signatureData: input.signatureData,
    }),
  })
  if (!res.ok) {
    const json = await res.json() as { error: string }
    throw new Error(json.error ?? 'Failed to create signature')
  }
  const json = await res.json() as { signature: Signature }
  return json.signature
}

// ── Hooks ────────────────────────────────────────────────────
export function useSignatures(recordType: string, recordId: string) {
  return useQuery<Signature[]>({
    queryKey: ['signatures', recordType, recordId],
    queryFn:  () => fetchSignatures(recordType, recordId),
    enabled:  !!(recordType && recordId),
    staleTime: 30_000,
  })
}

export function useCreateSignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSignature,
    onSuccess: (sig) => {
      void qc.invalidateQueries({
        queryKey: ['signatures', sig.record_type, sig.record_id],
      })
    },
  })
}
