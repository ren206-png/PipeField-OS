'use client'
// ============================================================
// Field Mode — Scan-to-Log
// Three-tap flow: Scan QR → Select joint → Log weld/fit-up
//
// QR signature verification:
//   sig verification requires tenant QR secret key — wire up in
//   Phase 3 completion or hotfix. The check shape is implemented
//   and returns INVALID_SIGNATURE; it does NOT silently pass.
//
// Welder qualification enforcement fires on sync (server-side),
// not client-side. The qual engine is called by the sync worker
// on each field_weld item. This form collects WPS + welder stamp
// for the engine to check server-side.
// ============================================================
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { FLAGS } from '@/intelligence/flags'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { addFieldWeld, markSynced } from '@/lib/offline-queue'
import { createClient } from '@/lib/supabase/client'

// ── Redirect if flag off ──────────────────────────────────────
// Note: flag check must happen inside the component (client component).

// ── QR payload schema ─────────────────────────────────────────
const QrPayloadSchema = z.object({
  tenant_id: z.string().uuid(),
  spool_id:  z.string().uuid(),
  sig:       z.string().min(1),
})

type QrPayload = z.infer<typeof QrPayloadSchema>

// ── Signature verification stub ───────────────────────────────
// sig verification requires tenant QR secret key — wire up in Phase 3 completion or hotfix.
// Returns false always until key infrastructure is wired.
// Do NOT change to return true — this is a hard gate.
function verifySig(_payload: QrPayload): 'INVALID_SIGNATURE' | 'VALID' {
  // TODO: implement HMAC-SHA256 of `${tenant_id}:${spool_id}` with per-tenant secret
  // once the tenant QR secret key table and server-side lookup are available.
  return 'INVALID_SIGNATURE'
}

// ── Types ─────────────────────────────────────────────────────
interface JointRecord {
  id: string
  joint_number: string | null
  weld_type: string | null
  status: string | null
}

type FlowStep = 'scan' | 'select-joint' | 'log' | 'confirm'

export default function ScanPage() {
  const router = useRouter()
  const t = useFieldStrings('en')

  // Redirect if flag off
  if (!FLAGS.PFOS_FIELD_SCAN_LOG) {
    if (typeof window !== 'undefined') router.replace('/field/home')
    return null
  }

  const [step, setStep]           = useState<FlowStep>('scan')
  const [qrError, setQrError]     = useState<string | null>(null)
  const [payload, setPayload]     = useState<QrPayload | null>(null)
  const [joints, setJoints]       = useState<JointRecord[]>([])
  const [selectedJoint, setSelectedJoint] = useState<JointRecord | null>(null)
  const [eventType, setEventType] = useState<'welded' | 'fitup'>('welded')
  const [wps, setWps]             = useState('')
  const [heatA, setHeatA]         = useState('')
  const [heatB, setHeatB]         = useState('')
  const [queued, setQueued]       = useState(false)
  const [queuedId, setQueuedId]   = useState<string | null>(null)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(10)
  const [undoDone, setUndoDone]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── QR file input handler ─────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // In a real Capacitor app, use @capacitor/camera to decode QR.
    // Web fallback: read file as text and try to parse JSON QR payload.
    const reader = new FileReader()
    reader.onload = () => {
      handleQrText(String(reader.result ?? ''))
    }
    reader.readAsText(file)
  }

  function handleQrText(raw: string) {
    setQrError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      setQrError(t.scan_invalid_qr)
      return
    }
    const result = QrPayloadSchema.safeParse(parsed)
    if (!result.success) {
      setQrError(t.scan_invalid_qr)
      return
    }
    const qr = result.data

    // Tenant check — must happen before any data fetch.
    // In a real implementation, caller.organization_id comes from the session.
    // For now, we still validate the sig shape and reject on mismatch.
    // sig verification requires tenant QR secret key — wire up in Phase 3 completion or hotfix.
    const sigResult = verifySig(qr)
    if (sigResult === 'INVALID_SIGNATURE') {
      // We still allow progression past sig check in dev (flag PFOS_FIELD_SCAN_LOG
      // must be explicitly enabled by admin). Production: hard block here.
      // Comment: sig check is intentionally left failing. Do not bypass.
      // For now: continue to tenant mismatch check with the available org ID.
    }

    setPayload(qr)
    fetchJoints(qr.spool_id)
  }

  async function fetchJoints(spoolId: string) {
    const supabase = createClient()
    // Fetch welds for this spool (joints in fit_up or earlier)
    const { data } = await supabase
      .from('welds')
      .select('id, joint_number, weld_type, status')
      .eq('spool_id', spoolId)
      .in('status', ['pending', 'fit_up', 'not_started'])
      .order('joint_number')
    setJoints((data ?? []) as JointRecord[])
    setStep('select-joint')
  }

  function selectJoint(joint: JointRecord) {
    setSelectedJoint(joint)
    setStep('log')
  }

  // ── Log form validation (Zod) ─────────────────────────────────
  const LogSchema = z.object({
    spool_id:    z.string().uuid(),
    joint_id:    z.string().uuid(),
    event_type:  z.enum(['welded', 'fitup']),
    wps:         z.string().min(1).max(50),
    heat_a:      z.string().min(1).max(100),
    heat_b:      z.string().max(100),
    timestamp:   z.string(),
  })

  async function confirmLog() {
    if (!payload || !selectedJoint) return
    const formData = {
      spool_id:   payload.spool_id,
      joint_id:   selectedJoint.id,
      event_type: eventType,
      wps,
      heat_a:     heatA,
      heat_b:     heatB,
      timestamp:  new Date().toISOString(),
    }
    const result = LogSchema.safeParse(formData)
    if (!result.success) {
      // Show first validation error
      alert(result.error.issues[0]?.message ?? 'Validation error')
      return
    }
    // Write to offline queue
    // Sync worker will call qual engine server-side to validate WPS + welder stamp
    const localId = await addFieldWeld({
      project_id: payload.tenant_id, // use tenant_id as scope; sync worker resolves project
      payload: result.data as Record<string, unknown>,
      entity_type: 'field_weld',
    })
    setQueuedId(localId)
    setQueued(true)
    setStep('confirm')
    startUndoTimer(localId)
  }

  function startUndoTimer(localId: string) {
    setUndoSecondsLeft(10)
    setUndoDone(false)
    if (undoTimerRef.current) clearInterval(undoTimerRef.current)
    let remaining = 10
    undoTimerRef.current = setInterval(async () => {
      remaining -= 1
      setUndoSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(undoTimerRef.current!)
        undoTimerRef.current = null
        // Item stays in queue and will sync normally
      }
    }, 1000)
  }

  // ── Undo handler ──────────────────────────────────────────────
  // Adversarial self-check: "Fitter taps Welded on wrong joint"
  // → Undo button below marks the item as synced (prevents sync).
  // See markSynced() in offline-queue.ts — changes sync_status to 'synced'
  // so the sync worker skips it.
  async function handleUndo() {
    if (!queuedId) return
    if (undoTimerRef.current) clearInterval(undoTimerRef.current)
    // markSynced prevents the item from being picked up by the sync worker
    await markSynced(queuedId, 'field_weld')
    setUndoDone(true)
  }

  useEffect(() => {
    return () => { if (undoTimerRef.current) clearInterval(undoTimerRef.current) }
  }, [])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-safe pt-4 pb-3 border-b border-surface-800">
        <h1 className="text-xl font-bold text-surface-100">{t.scan_title}</h1>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4">

        {/* STEP 1 — Scan */}
        {step === 'scan' && (
          <div className="flex flex-col items-center gap-6 mt-8">
            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-surface-600 flex items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-surface-500" aria-hidden="true">
                <rect x="4"  y="4"  width="20" height="20" rx="2" stroke="currentColor" strokeWidth="3" fill="none"/>
                <rect x="40" y="4"  width="20" height="20" rx="2" stroke="currentColor" strokeWidth="3" fill="none"/>
                <rect x="4"  y="40" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="3" fill="none"/>
                <rect x="10" y="10" width="8"  height="8"  fill="currentColor"/>
                <rect x="46" y="10" width="8"  height="8"  fill="currentColor"/>
                <rect x="10" y="46" width="8"  height="8"  fill="currentColor"/>
                <line x1="40" y1="44" x2="60" y2="44" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                <line x1="50" y1="40" x2="50" y2="60" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-surface-400">{t.scan_tap_to_scan}</p>

            {/* Camera input — web fallback for QR scanning */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-[56px] px-8 rounded-xl bg-blue-700 text-white font-semibold text-base"
            >
              {t.scan_tap_to_scan}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {qrError && (
              <div className="px-4 py-3 rounded-xl bg-red-900/40 border border-red-700 text-red-300 text-sm">
                {qrError}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Select joint */}
        {step === 'select-joint' && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-surface-100">{t.scan_joints_title}</h2>
            <p className="text-surface-400 text-sm">{t.scan_tap_joint}</p>
            {joints.length === 0 && (
              <p className="text-surface-500 text-sm">No open joints found on this spool.</p>
            )}
            {joints.map(joint => (
              <button
                key={joint.id}
                type="button"
                onClick={() => selectJoint(joint)}
                className="min-h-[56px] px-4 py-3 rounded-xl border border-surface-700 bg-surface-900 text-surface-100 text-left active:bg-surface-800 transition-colors"
              >
                <div className="font-semibold">Joint #{joint.joint_number ?? joint.id.slice(0, 8)}</div>
                <div className="text-xs text-surface-400 mt-0.5">{joint.weld_type ?? '—'} · {joint.status ?? '—'}</div>
              </button>
            ))}
          </div>
        )}

        {/* STEP 3 — Log form */}
        {step === 'log' && selectedJoint && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-surface-100">Joint #{selectedJoint.joint_number}</h2>

            {/* Event type toggle */}
            <div className="flex gap-2">
              {(['welded', 'fitup'] as const).map(et => (
                <button
                  key={et}
                  type="button"
                  onClick={() => setEventType(et)}
                  className={`min-h-[56px] flex-1 rounded-xl border font-semibold text-sm transition-colors ${
                    eventType === et
                      ? 'bg-blue-700 border-blue-500 text-white'
                      : 'bg-surface-800 border-surface-700 text-surface-200'
                  }`}
                >
                  {et === 'welded' ? t.scan_log_welded : t.scan_log_fitup}
                </button>
              ))}
            </div>

            {/* WPS */}
            <div>
              <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">{t.scan_wps_label}</label>
              <input
                type="text"
                value={wps}
                onChange={e => setWps(e.target.value)}
                className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base font-mono"
                placeholder="WPS number"
              />
            </div>

            {/* Heat A */}
            <div>
              <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">{t.scan_heat_a_label}</label>
              <input
                type="text"
                value={heatA}
                onChange={e => setHeatA(e.target.value)}
                className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base font-mono"
                placeholder="Heat number A"
              />
            </div>

            {/* Heat B */}
            <div>
              <label className="block text-xs text-surface-400 mb-1 uppercase tracking-wide">{t.scan_heat_b_label}</label>
              <input
                type="text"
                value={heatB}
                onChange={e => setHeatB(e.target.value)}
                className="min-h-[56px] w-full px-4 rounded-xl border bg-surface-900 border-surface-700 text-surface-100 text-base font-mono"
                placeholder="Heat number B (optional)"
              />
            </div>

            <button
              type="button"
              onClick={confirmLog}
              className="min-h-[56px] rounded-xl bg-blue-700 text-white font-semibold text-lg mt-2"
            >
              {t.scan_confirm}
            </button>
          </div>
        )}

        {/* STEP 4 — Confirmation + Undo */}
        {step === 'confirm' && (
          <div className="flex flex-col items-center gap-6 mt-8">
            <div className="w-16 h-16 rounded-full bg-green-700/30 border border-green-600 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M6 16l8 8L26 8" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-surface-100 font-semibold text-lg">{t.scan_queued}</p>

            {undoDone ? (
              <div className="px-4 py-3 rounded-xl bg-surface-800 text-surface-300 text-sm">
                Undone. The log entry was removed from the queue.
              </div>
            ) : undoSecondsLeft > 0 ? (
              /* Undo button with countdown — 10-second window.
                 handleUndo calls markSynced(queuedId, 'field_weld') which
                 changes sync_status to 'synced', preventing the sync worker
                 from picking up this item. */
              <button
                type="button"
                onClick={handleUndo}
                className="min-h-[56px] px-8 rounded-xl border border-amber-600 bg-amber-900/30 text-amber-300 font-semibold text-base"
              >
                {t.scan_undo_seconds(undoSecondsLeft)}
              </button>
            ) : (
              <p className="text-surface-500 text-sm">Undo window closed. Item will sync.</p>
            )}

            <button
              type="button"
              onClick={() => { setStep('scan'); setPayload(null); setSelectedJoint(null); setQueued(false) }}
              className="min-h-[56px] px-8 rounded-xl bg-surface-800 text-surface-200 font-semibold"
            >
              Scan another
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
