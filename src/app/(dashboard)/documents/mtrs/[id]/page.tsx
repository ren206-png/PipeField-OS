'use client'
// ============================================================
// MTR — Detail Page
// ============================================================
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { useMtr, useUpdateMtr } from '@/hooks/useMtr'
import {
  MTR_STATUS_LABELS,
  MTR_STATUS_COLORS,
  MTR_TYPE_LABELS,
  type MtrStatus,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-surface-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-surface-200 mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

export default function MtrDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: mtr, isLoading } = useMtr(id)
  const updateMtr = useUpdateMtr()

  if (isLoading) return <div className="p-6 text-surface-500">Loading…</div>
  if (!mtr)      return <div className="p-6 text-surface-500">MTR not found.</div>

  const hasChemistry = [mtr.carbon_pct, mtr.manganese_pct, mtr.phosphorus_pct, mtr.sulfur_pct, mtr.silicon_pct].some(v => v != null)
  const hasMechanical = [mtr.yield_strength, mtr.tensile_strength, mtr.elongation_pct, mtr.hardness].some(v => v != null)

  async function quickStatus(next: MtrStatus) {
    await updateMtr.mutateAsync({ id: mtr!.id, status: next })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/documents/mtrs" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-surface-50">{mtr.heat_number}</h1>
              <span className={cn('badge text-sm px-2.5 py-1 rounded', MTR_STATUS_COLORS[mtr.status])}>
                {MTR_STATUS_LABELS[mtr.status]}
              </span>
            </div>
            <p className="text-sm text-surface-400 mt-0.5">{mtr.material_spec}</p>
            {mtr.project && (
              <p className="text-xs text-surface-600 mt-0.5">
                {mtr.project.project_number} — {mtr.project.name}
              </p>
            )}
          </div>
        </div>
        <Link href={`/documents/mtrs/${id}/edit`} className="btn-ghost flex items-center gap-2 flex-shrink-0">
          <Edit2 className="w-4 h-4" /> Edit
        </Link>
      </div>

      {/* Quick status actions */}
      {mtr.status === 'received' && (
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-surface-400 flex-shrink-0">Quick action:</p>
          <button
            className="btn-primary text-sm py-1.5 px-4"
            onClick={() => quickStatus('accepted')}
            disabled={updateMtr.isPending}
          >
            Accept
          </button>
          <button
            className="text-sm py-1.5 px-4 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-colors border border-orange-500/30"
            onClick={() => quickStatus('quarantine')}
            disabled={updateMtr.isPending}
          >
            Quarantine
          </button>
          <button
            className="text-sm py-1.5 px-4 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors border border-red-500/30"
            onClick={() => quickStatus('rejected')}
            disabled={updateMtr.isPending}
          >
            Reject
          </button>
        </div>
      )}

      {/* 1. Material Info */}
      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Material Info</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Material Type"    value={MTR_TYPE_LABELS[mtr.material_type]} />
          <InfoRow label="Nominal Size"     value={mtr.nominal_size} />
          <InfoRow label="Schedule / Wall"  value={mtr.schedule} />
          <InfoRow label="MTR Number"       value={mtr.mtr_number} />
          <InfoRow label="Quantity"         value={mtr.quantity != null ? `${mtr.quantity} ${mtr.unit ?? ''}`.trim() : null} />
          <InfoRow label="Received Date"    value={mtr.received_date ? formatDate(mtr.received_date) : null} />
        </div>
      </section>

      {/* 2. Procurement */}
      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Procurement</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Supplier"          value={mtr.supplier} />
          <InfoRow label="Manufacturer"      value={mtr.manufacturer} />
          <InfoRow label="PO Number"         value={mtr.po_number} />
          <InfoRow label="Storage Location"  value={mtr.storage_location} />
        </div>
      </section>

      {/* 3. Chemical Composition */}
      {hasChemistry && (
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Chemical Composition</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left pb-2 text-xs text-surface-500 font-semibold uppercase tracking-wider">Element</th>
                  <th className="text-right pb-2 text-xs text-surface-500 font-semibold uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {[
                  ['Carbon (C)',     mtr.carbon_pct],
                  ['Manganese (Mn)', mtr.manganese_pct],
                  ['Phosphorus (P)', mtr.phosphorus_pct],
                  ['Sulfur (S)',     mtr.sulfur_pct],
                  ['Silicon (Si)',   mtr.silicon_pct],
                ].filter(([, v]) => v != null).map(([label, val]) => (
                  <tr key={label as string}>
                    <td className="py-2 text-surface-300">{label as string}</td>
                    <td className="py-2 text-right font-mono text-surface-200">
                      {(val as number).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 4. Mechanical Properties */}
      {hasMechanical && (
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Mechanical Properties</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {mtr.yield_strength != null && (
              <InfoRow label={`Yield Strength (${mtr.strength_unit ?? 'MPa'})`} value={mtr.yield_strength.toFixed(1)} />
            )}
            {mtr.tensile_strength != null && (
              <InfoRow label={`Tensile Strength (${mtr.strength_unit ?? 'MPa'})`} value={mtr.tensile_strength.toFixed(1)} />
            )}
            {mtr.elongation_pct != null && (
              <InfoRow label="Elongation %" value={`${mtr.elongation_pct.toFixed(2)}%`} />
            )}
            {mtr.hardness != null && (
              <InfoRow label="Hardness" value={mtr.hardness.toFixed(1)} />
            )}
          </div>
        </section>
      )}

      {/* 5. Notes */}
      {(mtr.rejection_reason || mtr.notes) && (
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Notes</h2>
          {mtr.rejection_reason && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Rejection / Quarantine Reason</p>
              <p className="text-sm text-red-300">{mtr.rejection_reason}</p>
            </div>
          )}
          {mtr.notes && (
            <p className="text-sm text-surface-400 whitespace-pre-wrap">{mtr.notes}</p>
          )}
        </section>
      )}
    </div>
  )
}
