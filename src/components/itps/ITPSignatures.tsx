'use client'
import { useState } from 'react'
import { PenLine, CheckCircle2 } from 'lucide-react'
import { useSignatures } from '@/hooks/useSignatures'
import SignatureModal from '@/components/shared/SignatureModal'

const ROLES = ['Inspector', 'QC Manager', 'Client Representative'] as const

interface Props {
  itpId: string
  currentUserName?: string
}

export function ITPSignatures({ itpId, currentUserName = '' }: Props) {
  const { data: signatures = [], isLoading } = useSignatures('itp', itpId)
  const [modalRole, setModalRole] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-200">Signatures</h3>
      </div>

      <div className="space-y-3">
        {ROLES.map(role => {
          const sig = signatures.find(s => s.role === role)
          return (
            <div
              key={role}
              className="flex items-center justify-between rounded-xl border border-surface-700 bg-surface-800 p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                {sig ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-surface-600 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-200">{role}</p>
                  {sig ? (
                    <p className="text-xs text-surface-500 truncate">
                      {sig.signer_name}
                      {sig.signer_title ? ` · ${sig.signer_title}` : ''}
                      {' · '}
                      {new Date(sig.signed_at).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-surface-500">Awaiting signature</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setModalRole(role)}
                className="ml-3 flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-300 hover:bg-surface-700 transition-colors"
              >
                <PenLine className="h-3.5 w-3.5" />
                {sig ? 'View' : 'Sign'}
              </button>
            </div>
          )
        })}
      </div>

      {isLoading && (
        <p className="text-xs text-surface-500 text-center">Loading signatures…</p>
      )}

      {modalRole && (
        <SignatureModal
          open
          onClose={() => setModalRole(null)}
          onSigned={() => setModalRole(null)}
          recordType="itp"
          recordId={itpId}
          role={modalRole}
          defaultSignerName={currentUserName}
        />
      )}
    </div>
  )
}
