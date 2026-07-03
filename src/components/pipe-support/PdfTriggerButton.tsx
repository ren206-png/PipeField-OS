'use client'
// ============================================================
// PdfTriggerButton — calls POST /api/pipe-support/pdf and
// opens the resulting PDF in a new tab (or triggers download).
// ============================================================
import { useState } from 'react'
import { FileDown, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  calcName: string
  inputs: Record<string, unknown>
  result: Record<string, unknown>
  calculationId?: string   // if already saved, pass the DB id
  variant?: 'primary' | 'ghost'
}

export function PdfTriggerButton({
  calcName, inputs, result, calculationId, variant = 'primary',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setErr(null)
    try {
      const body = calculationId
        ? { calculation_id: calculationId }
        : { name: calcName, inputs, result }

      const res = await fetch('/api/pipe-support/pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error ?? `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Revoke after a short delay to allow the tab to load the blob
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'PDF generation failed')
    } finally {
      setLoading(false)
    }
  }

  const base = variant === 'primary'
    ? 'rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center gap-2'
    : 'rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:border-orange-500 hover:text-orange-400 disabled:opacity-50 transition-colors flex items-center gap-2'

  return (
    <div className="space-y-1">
      <button onClick={handleGenerate} disabled={loading} className={base}>
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
        ) : (
          <><FileDown className="w-4 h-4" /> Download Calc Sheet (PDF)</>
        )}
      </button>
      {err && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
        </p>
      )}
    </div>
  )
}
