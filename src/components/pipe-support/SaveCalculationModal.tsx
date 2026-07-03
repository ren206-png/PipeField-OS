'use client'
// ============================================================
// SaveCalculationModal — modal dialog to name and save a
// completed pipe support calculation to the database.
// ============================================================
import { useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { useSavePipeSupportCalc } from '@/hooks/usePipeSupport'
import type { ProjectListItem } from '@/hooks/useProjects'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
  inputs: Record<string, unknown>
  result: Record<string, unknown>
  projects: ProjectListItem[]
  defaultProjectId?: string | null
}

export function SaveCalculationModal({
  open, onClose, onSaved, inputs, result, projects, defaultProjectId,
}: Props) {
  const [name, setName]           = useState('')
  const [notes, setNotes]         = useState('')
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '')
  const { mutate, isPending, error } = useSavePipeSupportCalc()

  if (!open) return null

  function handleSave() {
    if (!name.trim()) return
    mutate(
      {
        name:       name.trim(),
        notes:      notes.trim() || undefined,
        project_id: projectId || null,
        inputs,
        result,
      },
      {
        onSuccess: (data) => {
          setName('')
          setNotes('')
          onSaved(data.id)
          onClose()
        },
      }
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              <Save className="w-4 h-4 text-brand-400" />
              Save Calculation
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Calculation name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Calculation Name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 4&quot; CS Header — Bay 3"
                className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Project selector */}
            {projects.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                  Link to Project (optional)
                </label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 focus:border-brand-500 focus:outline-none transition-colors"
                >
                  <option value="">— No project —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Field conditions, assumptions, reviewer initials…"
                className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">
                {error instanceof Error ? error.message : 'Save failed — please try again.'}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-600 px-4 py-2.5 text-sm font-medium text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isPending}
              className="flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-4 h-4" /> Save</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
