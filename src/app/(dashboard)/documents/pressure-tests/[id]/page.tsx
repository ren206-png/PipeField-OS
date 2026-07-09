'use client'
// ============================================================
// Pressure Test — Detail Page
// ============================================================
import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2, CheckCircle, FileDown, Loader2, PenLine } from 'lucide-react'
import { usePressureTest, useUpdatePressureTest } from '@/hooks/usePressureTests'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from '@/hooks/useAuth'
import SignatureModal from '@/components/shared/SignatureModal'
import { useSignatures } from '@/hooks/useSignatures'
import {
  PT_RESULT_LABELS,
  PT_RESULT_COLORS,
  PT_STATUS_LABELS,
  PT_STATUS_COLORS,
  PT_TYPE_LABELS,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default function PressureTestDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: test, isLoading } = usePressureTest(id)
  const { isOrgAdmin } = useAuth()
  const updatePT = useUpdatePressureTest()
  const [downloading, setDownloading] = useState(false)
  const [sigRole, setSigRole] = useState<string | null>(null)
  const { data: signatures = [] } = useSignatures('pressure_test', id)

  async function handleApprove() {
    if (!test) return
    await updatePT.mutateAsync({ id: test.id, status: 'approved', approved_at: new Date().toISOString() })
  }

  async function downloadCertificate() {
    if (!test) return
    setDownloading(true)
    try {
      const res = await apiFetch('/api/reports/pressure-test-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: id }),
      })
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pressure-test-cert-${test.test_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate certificate')
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) return <div className="p-6 text-surface-500">Loading…</div>
  if (!test)     return <div className="p-6 text-surface-500">Test not found.</div>

  const pressureDrop = (test.initial_pressure != null && test.final_pressure != null)
    ? (test.initial_pressure - test.final_pressure).toFixed(2)
    : null

  const lineChips = test.line_numbers
    ? test.line_numbers.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/documents/pressure-tests" className="btn-ghost p-2 mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-xl text-surface-50">{test.test_number}</span>
            <span className={cn('badge', PT_RESULT_COLORS[test.result])}>{PT_RESULT_LABELS[test.result]}</span>
            <span className={cn('badge', PT_STATUS_COLORS[test.status])}>{PT_STATUS_LABELS[test.status]}</span>
          </div>
          <p className="text-surface-200 font-semibold text-lg">{test.system_name}</p>
          {test.project && (
            <p className="text-sm text-surface-400">{test.project.name} ({test.project.project_number})</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(test.result === 'pass' || test.status === 'approved') && (
            <button onClick={downloadCertificate} disabled={downloading} className="btn-primary flex items-center gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {downloading ? 'Generating…' : 'Download Certificate'}
            </button>
          )}
          {test.status === 'submitted' && isOrgAdmin && (
            <button
              onClick={handleApprove}
              disabled={updatePT.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
          )}
          <Link href={`/documents/pressure-tests/${test.id}/edit`} className="btn-ghost flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Parameters */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Test Parameters</h2>
          <Row label="Type">{PT_TYPE_LABELS[test.test_type]}</Row>
          <Row label="Medium">{test.test_medium}</Row>
          {test.design_pressure != null && (
            <Row label="Design Pressure">{test.design_pressure} {test.pressure_unit}</Row>
          )}
          <Row label="Test Pressure">{test.test_pressure} {test.pressure_unit}</Row>
          <Row label="Hold Duration">{test.hold_duration_min} minutes</Row>
        </section>

        {/* Execution */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Execution</h2>
          <Row label="Test Date">{formatDate(test.test_date)}</Row>
          {test.test_start_time && <Row label="Start Time">{test.test_start_time}</Row>}
          {test.test_end_time   && <Row label="End Time">{test.test_end_time}</Row>}
          {test.ambient_temp    && <Row label="Ambient Temp">{test.ambient_temp}</Row>}
          {test.initial_pressure != null && <Row label="Initial Pressure">{test.initial_pressure} {test.pressure_unit}</Row>}
          {test.final_pressure   != null && <Row label="Final Pressure">{test.final_pressure} {test.pressure_unit}</Row>}
          {pressureDrop != null && (
            <Row label="Pressure Drop">
              <span className={parseFloat(pressureDrop) > 0 ? 'text-yellow-300' : 'text-green-300'}>
                {pressureDrop} {test.pressure_unit}
              </span>
            </Row>
          )}
        </section>

        {/* Result */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Result</h2>
          <div>
            <span className={cn('badge text-sm px-3 py-1.5', PT_RESULT_COLORS[test.result])}>
              {PT_RESULT_LABELS[test.result]}
            </span>
          </div>
          {test.failure_reason && (
            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400 font-medium mb-1">Failure Reason</p>
              <p className="text-sm text-red-300">{test.failure_reason}</p>
            </div>
          )}
          {test.reinspection_date && (
            <Row label="Reinspection Date">{formatDate(test.reinspection_date)}</Row>
          )}
        </section>

        {/* Personnel */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Personnel</h2>
          <Row label="Inspector">{test.inspector_name}</Row>
          {test.witness_name && <Row label="Witness">{test.witness_name}</Row>}
          {test.witness_company && <Row label="Witness Company">{test.witness_company}</Row>}
        </section>
      </div>

      {/* Lines Tested */}
      {lineChips.length > 0 && (
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Lines Tested</h2>
          <div className="flex flex-wrap gap-2">
            {lineChips.map(line => (
              <span key={line} className="badge bg-surface-700 text-surface-200 font-mono text-xs">{line}</span>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {test.notes && (
        <section className="card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Notes</h2>
          <p className="text-sm text-surface-300 whitespace-pre-wrap">{test.notes}</p>
        </section>
      )}

      {/* Signatures */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          Signatures
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['Test Technician', 'QC Manager'] as const).map(role => {
            const sig = signatures.find(s => s.role === role)
            return (
              <div key={role} className="border border-surface-700 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">{role}</p>
                {sig ? (
                  <div className="space-y-2">
                    <div className="bg-white rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sig.signature_data} alt={`${role} signature`} className="w-full max-h-24 object-contain p-1" />
                    </div>
                    <p className="text-xs text-surface-300 font-medium">{sig.signer_name}</p>
                    {sig.signer_title && <p className="text-xs text-surface-500">{sig.signer_title}</p>}
                    <p className="text-xs text-surface-600">{new Date(sig.signed_at).toLocaleString()}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setSigRole(role)}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-surface-600 rounded-lg py-6 text-sm text-surface-500 hover:border-brand-500 hover:text-brand-400 transition-colors"
                  >
                    <PenLine className="w-4 h-4" />
                    Sign as {role}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Signature modal */}
      {sigRole && (
        <SignatureModal
          open={!!sigRole}
          onClose={() => setSigRole(null)}
          onSigned={() => setSigRole(null)}
          recordType="pressure_test"
          recordId={id}
          role={sigRole}
        />
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-surface-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-surface-200 text-right">{children}</span>
    </div>
  )
}
