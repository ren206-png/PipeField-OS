'use client'

// Full voice-to-log flow:
// 1. Record button (uses MediaRecorder API)
// 2. Upload to /api/field/voice-transcribe
// 3. Show suggestion card with raw transcript and structured suggestion
// 4. User can edit the note text and event_type before confirming
// 5. On Confirm: POST to /api/field/log with source: 'voice'
// 6. On Discard: nothing is written to personal_work_log — local state is garbage-collected
//
// CRITICAL: The confirm step is mandatory.
// The INSERT to personal_work_log happens ONLY inside handleConfirm().
// If the user closes the modal, taps Discard, or the component unmounts,
// handleConfirm() is never called and no write occurs.

import { useCallback, useRef, useState } from 'react'
import { useFieldStrings } from '@/lib/field-mode/locale'

// ── Types ─────────────────────────────────────────────────────
type FlowState = 'idle' | 'recording' | 'transcribing' | 'review' | 'confirmed' | 'discarded'

interface Suggestion {
  joint_id:   string | null
  event_type: 'welded' | 'fit_up' | 'note'
  note:       string
}

interface TranscribeResponse {
  raw_transcript: string
  suggestion:     Suggestion
}

interface LogEntry {
  id:              string
  event_type:      string
  logged_at:       string
  project_name:    string | null
  joint_number:    string | null
  weld_process:    string | null
  welder_stamp:    string | null
  nde_result:      string | null
  nde_released_at: string | null
  note:            string | null
  source:          'manual' | 'scan' | 'voice'
  corrects_row_id: string | null
}

interface Props {
  onConfirm: (entry: LogEntry) => void
  onDiscard: () => void
}

// ── Component ─────────────────────────────────────────────────
export default function VoiceNoteFlow({ onConfirm, onDiscard }: Props) {
  const s = useFieldStrings()

  const [flowState, setFlowState]       = useState<FlowState>('idle')
  const [rawTranscript, setRawTranscript] = useState<string>('')
  // suggestion holds local React state only — never written to DB until handleConfirm()
  const [suggestion, setSuggestion]     = useState<Suggestion | null>(null)
  const [editedNote, setEditedNote]     = useState('')
  const [editedEventType, setEditedEventType] = useState<Suggestion['event_type']>('note')
  const [error, setError]               = useState<string | null>(null)
  const [confirming, setConfirming]     = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<BlobPart[]>([])

  // ── Start recording ────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start()
      mediaRecorderRef.current = recorder
      setFlowState('recording')
    } catch {
      setError('Microphone access denied')
    }
  }, [])

  // ── Stop recording and transcribe ──────────────────────────
  const stopAndTranscribe = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    recorder.onstop = async () => {
      // Stop all audio tracks
      recorder.stream.getTracks().forEach(t => t.stop())

      setFlowState('transcribing')
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const form = new FormData()
      form.append('audio', blob, 'audio.webm')

      try {
        const res = await fetch('/api/field/voice-transcribe', { method: 'POST', body: form })
        if (!res.ok) throw new Error('Transcription request failed')
        const data = await res.json() as TranscribeResponse

        setRawTranscript(data.raw_transcript)
        setSuggestion(data.suggestion)
        setEditedNote(data.suggestion.note)
        setEditedEventType(data.suggestion.event_type)
        setFlowState('review')
      } catch (err) {
        console.error('[VoiceNoteFlow] transcription error', err)
        setError('Transcription failed — please try again')
        setFlowState('idle')
      }
    }

    recorder.stop()
  }, [])

  // ── Confirm: only INSERT happens here ─────────────────────
  // This is the ONLY path that writes to personal_work_log.
  // If this function is never called (discard / modal close),
  // no write occurs and the local suggestion state is garbage-collected.
  const handleConfirm = useCallback(async () => {
    if (!suggestion) return
    setConfirming(true)
    setError(null)
    try {
      const res = await fetch('/api/field/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type:   editedEventType,
          note:         editedNote,
          joint_number: suggestion.joint_id ?? undefined,
          source:       'voice',
        }),
      })
      if (!res.ok) throw new Error('Failed to save log entry')
      const { entry } = await res.json() as { entry: LogEntry }
      setFlowState('confirmed')
      onConfirm(entry)
    } catch (err) {
      console.error('[VoiceNoteFlow] confirm error', err)
      setError('Failed to save — please try again')
    } finally {
      setConfirming(false)
    }
  }, [suggestion, editedEventType, editedNote, onConfirm])

  // ── Discard: clears all local state, nothing written ──────
  // onDiscard() is called here and also when the user taps the backdrop.
  // Neither path calls handleConfirm(), so personal_work_log is untouched.
  const handleDiscard = useCallback(() => {
    // Clear all local suggestion state
    setSuggestion(null)
    setRawTranscript('')
    setEditedNote('')
    setFlowState('discarded')
    onDiscard()
  }, [onDiscard])

  // ── UI ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'flex-end', zIndex: 200,
    }}>
      {/* Backdrop tap → discard (nothing written) */}
      <div
        onClick={handleDiscard}
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Dismiss"
      />

      <div style={{
        position: 'relative',
        background: '#fff', width: '100%', borderRadius: '18px 18px 0 0',
        padding: '20px 16px 40px', boxSizing: 'border-box',
        zIndex: 10,
      }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>
          {s.voice_title}
        </div>

        {error && (
          <div style={{ color: '#a0390c', marginBottom: 12, fontSize: 13 }}>{error}</div>
        )}

        {/* ── IDLE ── */}
        {flowState === 'idle' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <button
              onClick={startRecording}
              style={{
                width: 80, height: 80, borderRadius: '50%', border: 'none',
                background: '#7c3aed', color: '#fff', fontSize: 32, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
              }}
            >
              🎙
            </button>
            <p style={{ marginTop: 12, color: '#555', fontSize: 14 }}>{s.voice_tap_to_record}</p>
          </div>
        )}

        {/* ── RECORDING ── */}
        {flowState === 'recording' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 16 }}>{s.voice_recording}</div>
            <button
              onClick={stopAndTranscribe}
              style={{
                width: 80, height: 80, borderRadius: '50%', border: '4px solid #7c3aed',
                background: '#fff', color: '#7c3aed', fontSize: 28, cursor: 'pointer',
                animation: 'pulse 1.2s infinite',
              }}
            >
              ⏹
            </button>
          </div>
        )}

        {/* ── TRANSCRIBING ── */}
        {flowState === 'transcribing' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#555', fontSize: 14 }}>
            {s.voice_transcribing}
          </div>
        )}

        {/* ── REVIEW ── */}
        {flowState === 'review' && suggestion && (
          <div>
            {/* Raw transcript — read-only, greyed */}
            <div style={{
              background: '#f3f4f6', borderRadius: 8, padding: '10px 12px',
              marginBottom: 14, color: '#6b7280', fontSize: 12,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#9ca3af', fontSize: 11 }}>
                Raw transcript
              </div>
              {rawTranscript}
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              {s.voice_suggestion_title}
            </div>

            {/* Joint ID (if found) */}
            {suggestion.joint_id && (
              <div style={{ marginBottom: 10, fontSize: 13 }}>
                <strong>Joint ID:</strong> {suggestion.joint_id}
                <span style={{ color: '#6b7280', marginLeft: 6 }}>— Is this correct?</span>
              </div>
            )}

            {!suggestion.joint_id && (
              <div style={{ marginBottom: 10, fontSize: 12, color: '#6b7280' }}>
                {s.voice_no_joint_found}
              </div>
            )}

            {/* Editable event type */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Entry type
              </label>
              <select
                value={editedEventType}
                onChange={e => setEditedEventType(e.target.value as Suggestion['event_type'])}
                style={{
                  width: '100%', height: 40, borderRadius: 8,
                  border: '1px solid #ccc', padding: '0 8px', fontSize: 14,
                }}
              >
                <option value="welded">{s.log_entry_welded}</option>
                <option value="fit_up">{s.log_entry_fitup}</option>
                <option value="note">{s.log_entry_note}</option>
              </select>
            </div>

            {/* Editable note */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Note
              </label>
              <textarea
                value={editedNote}
                onChange={e => setEditedNote(e.target.value)}
                style={{
                  width: '100%', height: 80, borderRadius: 8, border: '1px solid #ccc',
                  padding: 10, fontSize: 14, boxSizing: 'border-box', resize: 'none',
                }}
              />
            </div>

            {/* Disclaimer — always visible in review state */}
            <div style={{
              background: '#fef9c3', border: '1px solid #fde047',
              borderRadius: 8, padding: '8px 12px',
              fontSize: 12, color: '#7c5c00', marginBottom: 16,
            }}>
              ⚠ {s.voice_disclaimer}
            </div>

            {/* Discard (smaller, above confirm) */}
            <button
              onClick={handleDiscard}
              style={{
                display: 'block', width: '100%', height: 44,
                borderRadius: 8, border: '1px solid #ccc',
                background: '#fff', color: '#374151', fontSize: 14,
                cursor: 'pointer', marginBottom: 10,
              }}
            >
              {s.voice_discard_btn}
            </button>

            {/* Confirm — min 56px, bottom 60% of modal */}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                display: 'block', width: '100%', height: 56,
                borderRadius: 12, border: 'none',
                background: confirming ? '#93c5fd' : '#2563eb',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: confirming ? 'not-allowed' : 'pointer',
              }}
            >
              {confirming ? '…' : s.voice_confirm_btn}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
