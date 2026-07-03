'use client'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { useExpiringCerts } from '@/hooks/useWelderCerts'
import Link from 'next/link'

export function CertExpiryBanner() {
  const { data: expiringRaw } = useExpiringCerts(30)
  const expiring = Array.isArray(expiringRaw) ? expiringRaw : []
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || expiring.length === 0) return null

  const critical = expiring.filter(c => {
    const days = Math.ceil((new Date(c.expiry_date).getTime() - Date.now()) / 86400000)
    return days <= 7
  })

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
      critical.length > 0
        ? 'border-danger/30 bg-danger/10'
        : 'border-warning/30 bg-warning/10'
    }`}>
      <AlertTriangle className={`h-4 w-4 shrink-0 ${critical.length > 0 ? 'text-danger' : 'text-warning'}`} />
      <p className="flex-1 text-sm text-surface-200">
        <span className="font-semibold">
          {expiring.length} welder cert{expiring.length > 1 ? 's' : ''} expiring within 30 days
        </span>
        {critical.length > 0 && (
          <span className="text-danger ml-1">({critical.length} within 7 days!)</span>
        )}
      </p>
      <Link href="/welders" className="text-xs font-semibold text-brand-400 hover:text-brand-300 shrink-0">
        View Welders
      </Link>
      <button onClick={() => setDismissed(true)} className="shrink-0 rounded p-0.5 hover:bg-surface-700">
        <X className="h-4 w-4 text-surface-400" />
      </button>
    </div>
  )
}
