'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useUpdateWeldStatus } from '@/hooks/useWelds'
import type { WeldStatus } from '@/types'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:           ['fit_up_approved'],
  fit_up_approved: ['welded', 'draft'],
  welded:          ['visual_pass', 'failed'],
  visual_pass:     ['xray_pending', 'accepted'],
  xray_pending:    ['accepted', 'failed'],
  failed:          ['repaired'],
  repaired:        ['visual_pass', 'xray_pending'],
  accepted:        [],
}

const STATUS_LABELS: Record<string, string> = {
  draft:           'Draft',
  fit_up_approved: 'Fit-Up Approved',
  welded:          'Welded',
  visual_pass:     'Visual Pass',
  xray_pending:    'X-Ray Pending',
  failed:          'Failed',
  repaired:        'Repaired',
  accepted:        'Accepted',
}

const STATUS_COLORS: Record<string, string> = {
  draft:           'bg-surface-700 text-surface-400',
  fit_up_approved: 'bg-blue-500/15 text-blue-300',
  welded:          'bg-brand-500/15 text-brand-300',
  visual_pass:     'bg-teal-500/15 text-teal-300',
  xray_pending:    'bg-purple-500/15 text-purple-300',
  failed:          'bg-red-500/15 text-red-300',
  repaired:        'bg-orange-500/15 text-orange-300',
  accepted:        'bg-green-500/15 text-green-300',
}

interface InlineStatusMenuProps {
  weldId:        string
  currentStatus: string
  onUpdated:     () => void
  onClose:       () => void
}

export function InlineStatusMenu({ weldId, currentStatus, onUpdated, onClose }: InlineStatusMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { mutateAsync, isPending } = useUpdateWeldStatus()
  const [saving, setSaving] = useState(false)

  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? []

  // Close on Escape or click outside
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onClose])

  async function handleSelect(newStatus: string) {
    setSaving(true)
    try {
      await mutateAsync({ weldId, newStatus: newStatus as WeldStatus })
      onUpdated()
      onClose()
    } catch {
      // mutation handles rollback; just close the menu
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isLoading = saving || isPending

  return (
    <div
      ref={menuRef}
      className="absolute top-full mt-1 right-0 z-50 bg-surface-800 border border-surface-600 rounded-xl shadow-xl p-3 min-w-[180px]"
    >
      <p className="text-xs font-semibold text-surface-400 mb-2">Update Status</p>

      {nextStatuses.length === 0 ? (
        <p className="text-xs text-surface-500">No further transitions available</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-3">
          {nextStatuses.map(s => (
            <button
              key={s}
              disabled={isLoading}
              onClick={() => handleSelect(s)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity disabled:opacity-50 ${STATUS_COLORS[s] ?? 'bg-surface-700 text-surface-300'}`}
            >
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        {isLoading && <Loader2 className="w-3.5 h-3.5 text-surface-400 animate-spin" />}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="text-xs text-surface-500 hover:text-surface-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
