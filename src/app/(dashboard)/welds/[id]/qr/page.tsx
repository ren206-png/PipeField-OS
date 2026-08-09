'use client'
// ============================================================
// QR Sticker Print Page — /welds/[id]/qr
// A clean print-optimised page showing the QR code + weld info.
// User hits Ctrl+P / ⌘+P and prints directly to a label printer
// or saves as PDF for cutting into stickers.
// ============================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { useWeld } from '@/hooks/useWelds'
import { QRCode } from '@/components/shared/QRCode'
import { WeldStatusBadge } from '@/components/welds/WeldStatusBadge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate } from '@/lib/utils'
import type { WeldStatus } from '@/types'

interface PageProps { params: { id: string } }

export default function WeldQRPage({ params }: PageProps) {
  const { id }  = params
  const { data: weld, isLoading } = useWeld(id)
  const [origin, setOrigin] = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])

  if (isLoading) return <LoadingSpinner />
  if (!weld) {
    return (
      <div className="text-center py-24">
        <p className="text-surface-400">Weld not found.</p>
        <Link href="/welds" className="btn-ghost mt-4 inline-flex">← Back</Link>
      </div>
    )
  }

  const weldUrl = `${origin}/welds/${id}`

  return (
    <>
      {/* ── Screen controls (hidden when printing) ── */}
      <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/welds/${id}`}
          className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold text-surface-50">QR Sticker</h1>
          <p className="text-xs text-surface-500">Print and apply to pipe or spool tag</p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* ── Sticker sheet — 4-up grid ── */}
      {/* Each sticker is identical. Print on label sheet and cut. */}
      <div className="
        grid grid-cols-2 gap-4 max-w-2xl mx-auto
        print:grid-cols-2 print:gap-2 print:max-w-none print:m-0
      ">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="
              card p-5 flex flex-col items-center gap-3 text-center
              print:border print:border-gray-300 print:rounded-lg print:p-4
              print:break-inside-avoid
            "
          >
            {/* QR */}
            <div className="bg-white p-2 rounded-lg">
              <QRCode value={weldUrl} size={160} />
            </div>

            {/* Weld ID — large for quick field reading */}
            <div>
              <p className="text-2xl font-black font-mono text-surface-50 tracking-tight print:text-black print:text-2xl">
                {weld.weld_id_number}
              </p>
              <div className="mt-1 print:hidden">
                <WeldStatusBadge status={weld.status as WeldStatus} size="sm" />
              </div>
              <p className="hidden print:block text-sm text-gray-600 mt-0.5">{weld.status}</p>
            </div>

            {/* Details */}
            <div className="w-full space-y-1 text-xs border-t border-surface-700/60 pt-3 print:border-gray-200">
              {weld.welder_stamp && (
                <div className="flex justify-between">
                  <span className="text-surface-500 print:text-gray-500">Stamp</span>
                  <span className="font-mono font-bold text-brand-300 print:text-black">{weld.welder_stamp}</span>
                </div>
              )}
              {weld.welder_name && (
                <div className="flex justify-between">
                  <span className="text-surface-500 print:text-gray-500">Welder</span>
                  <span className="text-surface-300 print:text-black">{weld.welder_name}</span>
                </div>
              )}
              {weld.weld_date && (
                <div className="flex justify-between">
                  <span className="text-surface-500 print:text-gray-500">Date</span>
                  <span className="text-surface-300 print:text-black">{formatDate(weld.weld_date)}</span>
                </div>
              )}
              {weld.spool_number && (
                <div className="flex justify-between">
                  <span className="text-surface-500 print:text-gray-500">Spool</span>
                  <span className="font-mono text-surface-300 print:text-black">{weld.spool_number}</span>
                </div>
              )}
            </div>

            {/* Footer URL */}
            <p className="text-xs text-surface-600 font-mono break-all print:text-gray-400 print:text-xs">
              PipeField OS
            </p>
          </div>
        ))}
      </div>

      {/* ── Print tip ── */}
      <div className="max-w-2xl mx-auto mt-6 card p-4 print:hidden">
        <p className="text-sm text-surface-500 text-center">
          <strong className="text-surface-300">Tip:</strong> Press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-700 text-surface-300 text-xs font-mono">Ctrl+P</kbd>
          {' '}→ set paper size to <strong className="text-surface-300">4×6&quot;</strong> label or <strong className="text-surface-300">Letter</strong> → Save as PDF to cut into 4 stickers.
        </p>
      </div>
    </>
  )
}
