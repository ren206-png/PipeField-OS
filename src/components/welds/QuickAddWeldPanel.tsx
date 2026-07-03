'use client'
// ============================================================
// QuickAddWeldPanel — slide-in panel for fast weld creation.
//
// Fields: Weld Number, Project, Joint Type, Diameter (pipe_size),
//         Schedule/Wall (wall_thickness).
// Inserts via Supabase client (same pattern as /welds/new page).
// Status is always set to 'draft' on creation.
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'

const JOINT_TYPES = ['Butt', 'Socket', 'Fillet', 'Stub-End', 'Flange'] as const
type JointType = typeof JOINT_TYPES[number]

interface QuickAddWeldPanelProps {
  open:      boolean
  onClose:   () => void
  onCreated: () => void
}

interface FormState {
  weld_id_number: string
  project_id:     string
  joint_type:     JointType | ''
  pipe_size:      string
  wall_thickness: string
}

const INITIAL: FormState = {
  weld_id_number: '',
  project_id:     '',
  joint_type:     '',
  pipe_size:      '',
  wall_thickness: '',
}

export function QuickAddWeldPanel({ open, onClose, onCreated }: QuickAddWeldPanelProps) {
  const { profile }              = useAuth()
  const { data: projects = [] }  = useProjects()

  const [form,    setForm]    = useState<FormState>(INITIAL)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const firstInputRef = useRef<HTMLInputElement>(null)

  // Focus first field when panel opens; reset form when it closes
  useEffect(() => {
    if (open) {
      setForm(INITIAL)
      setError(null)
      // slight delay so the CSS transition has begun before we steal focus
      const t = setTimeout(() => firstInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.organization_id) return

    if (!form.weld_id_number.trim()) {
      setError('Weld Number is required.')
      return
    }

    if (!form.project_id) {
      setError('Project is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: insertErr } = await supabase
        .from('welds')
        .insert({
          organization_id: profile.organization_id,
          weld_id_number:  form.weld_id_number.trim(),
          status:          'draft',
          project_id:      form.project_id,
          // joint_type is stored in notes as a lightweight approach since
          // the schema doesn't have a dedicated column — use pipe_size / wall_thickness
          // columns that do exist.  joint_type goes in notes as a prefix.
          notes:           form.joint_type ? `Joint Type: ${form.joint_type}` : null,
          pipe_size:       form.pipe_size        || null,
          wall_thickness:  form.wall_thickness   || null,
          created_by:      profile.id,
        })

      if (insertErr) throw new Error(insertErr.message)

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Quick-Add Weld"
        className={[
          'fixed inset-y-0 right-0 z-50 w-full sm:w-96',
          'flex flex-col bg-surface-800 shadow-2xl',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-base font-semibold text-surface-50">Quick-Add Weld</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="text-surface-500 hover:text-surface-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex-1 space-y-5 px-5 py-5">

            {/* Weld Number */}
            <div>
              <label htmlFor="qa-weld-number" className="label">
                Weld Number <span className="text-red-400">*</span>
              </label>
              <input
                ref={firstInputRef}
                id="qa-weld-number"
                type="text"
                value={form.weld_id_number}
                onChange={e => set('weld_id_number', e.target.value)}
                placeholder="e.g. W-0042"
                className="input w-full"
                required
                maxLength={50}
              />
            </div>

            {/* Project */}
            <div>
              <label htmlFor="qa-project" className="label">Project <span className="text-red-400">*</span></label>
              <select
                id="qa-project"
                value={form.project_id}
                onChange={e => set('project_id', e.target.value)}
                className="input w-full"
              >
                <option value="">— No project —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Joint Type */}
            <div>
              <label htmlFor="qa-joint-type" className="label">Joint Type</label>
              <select
                id="qa-joint-type"
                value={form.joint_type}
                onChange={e => set('joint_type', e.target.value as JointType | '')}
                className="input w-full"
              >
                <option value="">— Select type —</option>
                {JOINT_TYPES.map(jt => (
                  <option key={jt} value={jt}>{jt}</option>
                ))}
              </select>
            </div>

            {/* Diameter (pipe_size) */}
            <div>
              <label htmlFor="qa-diameter" className="label">Diameter (inches)</label>
              <input
                id="qa-diameter"
                type="number"
                min={0}
                step="0.125"
                value={form.pipe_size}
                onChange={e => set('pipe_size', e.target.value)}
                placeholder="e.g. 4"
                className="input w-full"
              />
            </div>

            {/* Schedule / Wall */}
            <div>
              <label htmlFor="qa-wall" className="label">Schedule / Wall</label>
              <input
                id="qa-wall"
                type="text"
                value={form.wall_thickness}
                onChange={e => set('wall_thickness', e.target.value)}
                placeholder="e.g. Sch 40"
                className="input w-full"
                maxLength={20}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-surface-700">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-ghost flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Add Weld'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
