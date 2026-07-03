'use client'
// ============================================================
// SignatureModal — captures or displays a signature for a record
// ============================================================
import { useState, useEffect } from 'react'
import { X, PenLine, CheckCircle2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useSignatures, useCreateSignature } from '@/hooks/useSignatures'

const SignaturePad = dynamic(() => import('./SignaturePad'), { ssr: false })

interface Props {
  open:              boolean
  onClose:           () => void
  onSigned:          () => void
  recordType:        string
  recordId:          string
  role:              string
  defaultSignerName?: string
}

export default function SignatureModal({
  open, onClose, onSigned,
  recordType, recordId, role, defaultSignerName = '',
}: Props) {
  const [signerName,  setSignerName]  = useState(defaultSignerName)
  const [signerTitle, setSignerTitle] = useState('')

  const { data: sigs = [] } = useSignatures(recordType, recordId)
  const createSig = useCreateSignature()

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSignerName(defaultSignerName)
      setSignerTitle('')
    }
  }, [open, defaultSignerName])

  if (!open) return null

  // Check if this role is already signed
  const existing = sigs.find(s => s.role === role)

  async function handleSave(dataUrl: string) {
    if (!signerName.trim()) {
      alert('Please enter the signer name before saving.')
      return
    }
    await createSig.mutateAsync({
      recordType,
      recordId,
      role,
      signerName:    signerName.trim(),
      signerTitle:   signerTitle.trim() || undefined,
      signatureData: dataUrl,
    })
    onSigned()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-surface-100">
              {existing ? 'Signature on file' : `Sign as ${role}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Existing signature display */}
          {existing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-300">{existing.signer_name}</p>
                  {existing.signer_title && (
                    <p className="text-xs text-green-400/80">{existing.signer_title}</p>
                  )}
                  <p className="text-xs text-green-500/70 mt-0.5">
                    Signed {new Date(existing.signed_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl overflow-hidden border border-surface-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existing.signature_data}
                  alt="Signature"
                  className="w-full max-h-40 object-contain p-2"
                />
              </div>
              <button onClick={onClose} className="btn-ghost w-full">Close</button>
            </div>
          ) : (
            <>
              {/* Signer info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">
                    Signer Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="input w-full"
                    placeholder="Full name"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Title / Role</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. QC Manager"
                    value={signerTitle}
                    onChange={e => setSignerTitle(e.target.value)}
                  />
                </div>
              </div>

              {/* Signature pad */}
              <SignaturePad onSave={handleSave} />

              {createSig.isError && (
                <p className="text-sm text-red-400">
                  Failed to save signature. Please try again.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
