'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { redirect } from 'next/navigation'
import { FLAGS } from '@/intelligence/flags'
import { useFieldStrings } from '@/lib/field-mode/locale'
import dynamic from 'next/dynamic'

// ── Flag gate ─────────────────────────────────────────────────
if (!FLAGS.PFOS_FIELD_PERSONAL_LOG) {
  redirect('/home')
}

// ── Types ─────────────────────────────────────────────────────
interface LogEntry {
  id:              string
  event_type:      'welded' | 'fit_up' | 'note' | 'correction'
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

// ── Lazy-load VoiceNoteFlow behind the voice-notes flag ───────
const VoiceNoteFlow = FLAGS.PFOS_FIELD_VOICE_NOTES
  ? dynamic(() => import('@/components/field-mode/VoiceNoteFlow'), { ssr: false })
  : null

// ── Helper components ─────────────────────────────────────────
function EventBadge({ type }: { type: LogEntry['event_type'] }) {
  const s = useFieldStrings()
  const labels: Record<LogEntry['event_type'], string> = {
    welded:     s.log_entry_welded,
    fit_up:     s.log_entry_fitup,
    note:       s.log_entry_note,
    correction: s.log_correction_note,
  }
  const colors: Record<LogEntry['event_type'], string> = {
    welded:     '#1a7f3c',
    fit_up:     '#0057b8',
    note:       '#7c5c00',
    correction: '#a0390c',
  }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      background: colors[type] + '22',
      color: colors[type],
      border: `1px solid ${colors[type]}55`,
    }}>
      {labels[type]}
    </span>
  )
}

function NdeBadge({ result }: { result: string | null }) {
  const s = useFieldStrings()
  if (!result) return null
  const map: Record<string, { label: string; color: string }> = {
    pass:    { label: s.log_nde_released, color: '#1a7f3c' },
    fail:    { label: s.log_nde_failed,   color: '#a0390c' },
    pending: { label: s.log_nde_pending,  color: '#7c5c00' },
  }
  const entry = map[result]
  if (!entry) return null
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: entry.color + '22',
      color: entry.color,
      border: `1px solid ${entry.color}55`,
      marginLeft: 6,
    }}>
      {s.log_nde_label}: {entry.label}
    </span>
  )
}

function SourceIcon({ source }: { source: LogEntry['source'] }) {
  if (source === 'scan')  return <span title="Scanned" style={{ fontSize: 14 }}>📷</span>
  if (source === 'voice') return <span title="Voice note" style={{ fontSize: 14 }}>🎙</span>
  return <span title="Manual" style={{ fontSize: 14 }}>✏️</span>
}

function EntryCard({ entry }: { entry: LogEntry }) {
  const s = useFieldStrings()
  const [expanded, setExpanded] = useState(false)
  const noteText = entry.note ?? ''
  const truncated = noteText.length > 120 && !expanded

  return (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.09)',
      borderLeft: '3px solid #2563eb',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <EventBadge type={entry.event_type} />
        {entry.nde_result && <NdeBadge result={entry.nde_result} />}
        <span style={{ marginLeft: 'auto' }}>
          <SourceIcon source={entry.source} />
        </span>
      </div>

      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <strong>{s.log_date_label}:</strong>{' '}
        {new Date(entry.logged_at).toLocaleString()}
      </div>

      {entry.project_name && (
        <div style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>
          <strong>{s.log_project_label}:</strong> {entry.project_name}
        </div>
      )}
      {entry.joint_number && (
        <div style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>
          <strong>{s.log_joint_label}:</strong> {entry.joint_number}
        </div>
      )}
      {entry.weld_process && (
        <div style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>
          <strong>{s.log_process_label}:</strong> {entry.weld_process}
          {entry.welder_stamp ? ` — ${entry.welder_stamp}` : ''}
        </div>
      )}

      {noteText.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 13, color: '#222' }}>
          {truncated ? noteText.slice(0, 120) + '…' : noteText}
          {noteText.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ marginLeft: 6, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add Note Modal ────────────────────────────────────────────
function AddNoteModal({
  onSave,
  onCancel,
}: {
  onSave: (note: string) => Promise<void>
  onCancel: () => void
}) {
  const s = useFieldStrings()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    await onSave(text.trim())
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', width: '100%', borderRadius: '16px 16px 0 0',
        padding: '20px 16px 32px', boxSizing: 'border-box',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{s.log_add_note_btn}</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={s.log_note_placeholder}
          style={{
            width: '100%', height: 120, borderRadius: 8, border: '1px solid #ccc',
            padding: 10, fontSize: 14, boxSizing: 'border-box', resize: 'none',
          }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 48, borderRadius: 8, border: '1px solid #ccc',
              background: '#fff', fontSize: 15, cursor: 'pointer',
            }}
          >
            {s.log_cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            style={{
              flex: 2, height: 56, borderRadius: 8, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '…' : s.log_save_note}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Export Menu ───────────────────────────────────────────────
function ExportMenu({ onClose }: { onClose: () => void }) {
  const s = useFieldStrings()

  function triggerDownload(format: 'pdf' | 'csv') {
    const url = `/api/field/log/export?format=${format}`
    const link = document.createElement('a')
    link.href = url
    link.download = `my-log-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'html'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    onClose()
  }

  return (
    <div style={{
      position: 'absolute', top: 48, right: 0, background: '#fff',
      border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      zIndex: 50, minWidth: 160,
    }}>
      <button
        onClick={() => triggerDownload('csv')}
        style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
      >
        {s.log_export_csv}
      </button>
      <button
        onClick={() => triggerDownload('pdf')}
        style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
      >
        {s.log_export_pdf}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function LogPage() {
  const s = useFieldStrings()

  const [entries, setEntries]         = useState<LogEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [nextCursor, setNextCursor]   = useState<string | null>(null)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showExport, setShowExport]   = useState(false)
  const [showVoice, setShowVoice]     = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  // ── Fetch page of entries ─────────────────────────────────
  const fetchEntries = useCallback(async (cursor?: string) => {
    const url = `/api/field/log?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch log')
    return res.json() as Promise<{ entries: LogEntry[]; next_cursor: string | null }>
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchEntries()
      .then(data => {
        if (cancelled) return
        setEntries(data.entries)
        setNextCursor(data.next_cursor)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchEntries])

  // ── Infinite scroll ───────────────────────────────────────
  useEffect(() => {
    const node = loaderRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && nextCursor && !fetchingMore) {
          setFetchingMore(true)
          fetchEntries(nextCursor)
            .then(data => {
              setEntries(prev => [...prev, ...data.entries])
              setNextCursor(data.next_cursor)
            })
            .catch(console.error)
            .finally(() => setFetchingMore(false))
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [nextCursor, fetchingMore, fetchEntries])

  // ── Save note ─────────────────────────────────────────────
  async function handleSaveNote(note: string) {
    const res = await fetch('/api/field/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'note', note, source: 'manual' }),
    })
    if (!res.ok) throw new Error('Failed to save note')
    const { entry } = await res.json() as { entry: LogEntry }
    setEntries(prev => [entry, ...prev])
    setShowAddNote(false)
  }

  // ── Append entry after voice confirmation ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleVoiceConfirm(entry: any) {
    setEntries(prev => [entry as LogEntry, ...prev])
    setShowVoice(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f6', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{s.log_title}</h1>

        {/* Export button with dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExport(prev => !prev)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #2563eb',
              background: '#fff', color: '#2563eb', fontWeight: 600, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {s.log_export_btn}
          </button>
          {showExport && <ExportMenu onClose={() => setShowExport(false)} />}
        </div>
      </div>

      {/* What's included disclosure */}
      <div style={{
        padding: '8px 16px',
        fontSize: 11,
        color: '#6b7280',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {s.log_export_what_included}
      </div>

      {/* Entry list */}
      <div style={{ padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', paddingTop: 40 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', paddingTop: 40 }}>{s.log_empty}</div>
        ) : (
          entries.map(entry => <EntryCard key={entry.id} entry={entry} />)
        )}

        {/* Infinite scroll sentinel */}
        <div ref={loaderRef} style={{ height: 1 }} />
        {fetchingMore && (
          <div style={{ textAlign: 'center', color: '#888', padding: 12 }}>Loading more…</div>
        )}
      </div>

      {/* Add Note button — bottom 60%, min 56px */}
      <div style={{
        position: 'fixed',
        bottom: FLAGS.PFOS_FIELD_VOICE_NOTES ? 84 : 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'calc(100% - 32px)',
        maxWidth: 480,
      }}>
        <button
          onClick={() => setShowAddNote(true)}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 12,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
          }}
        >
          {s.log_add_note_btn}
        </button>
      </div>

      {/* Voice note FAB — only when PFOS_FIELD_VOICE_NOTES is enabled */}
      {FLAGS.PFOS_FIELD_VOICE_NOTES && (
        <button
          onClick={() => setShowVoice(true)}
          aria-label={s.voice_title}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: 'none',
            background: '#7c3aed',
            color: '#fff',
            fontSize: 26,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🎙
        </button>
      )}

      {/* Modals */}
      {showAddNote && (
        <AddNoteModal
          onSave={handleSaveNote}
          onCancel={() => setShowAddNote(false)}
        />
      )}

      {showVoice && VoiceNoteFlow && (
        <VoiceNoteFlow
          onConfirm={handleVoiceConfirm}
          onDiscard={() => setShowVoice(false)}
        />
      )}

      {/* Close export dropdown when clicking outside */}
      {showExport && (
        <div
          onClick={() => setShowExport(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 30 }}
        />
      )}
    </div>
  )
}
