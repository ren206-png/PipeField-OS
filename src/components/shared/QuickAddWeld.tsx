'use client'
import { useState } from 'react'
import { Plus, X, Flame } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/apiFetch'
import { useProjects } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'

const WELD_STATUSES = [
  { value: 'not_welded',      label: 'Not Welded' },
  { value: 'in_progress',     label: 'In Progress' },
  { value: 'welded',          label: 'Welded' },
  { value: 'fit_up_approved', label: 'Fit-Up Approved' },
  { value: 'visual_pass',     label: 'Visual Pass' },
  { value: 'accepted',        label: 'Accepted' },
  { value: 'failed',          label: 'Failed' },
]

export function QuickAddWeld() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    project_id:     '',
    weld_id_number: '',
    welder_stamp:   '',
    status:         'welded',
  })
  const queryClient = useQueryClient()
  const { data: projects = [] } = useProjects()

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/welds', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create weld')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Weld logged', { description: `${form.weld_id_number} added successfully` })
      queryClient.invalidateQueries({ queryKey: ['welds'] })
      setOpen(false)
      setForm({ project_id: '', weld_id_number: '', welder_stamp: '', status: 'welded' })
    },
    onError: (err: Error) => {
      toast.error('Failed to log weld', { description: err.message })
    },
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <>
      {/* FAB — only on mobile, sits above the bottom nav */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-brand-500 hover:bg-brand-400 rounded-full shadow-lg shadow-brand-500/30 flex items-center justify-center transition-all active:scale-95"
        aria-label="Quick add weld"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          {/* Sheet */}
          <div className="relative bg-surface-900 rounded-t-2xl border-t border-surface-700 px-4 pt-4 pb-8 safe-area-inset-bottom">
            {/* Handle */}
            <div className="w-10 h-1 bg-surface-700 rounded-full mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-brand-400" />
                <h3 className="text-base font-semibold text-surface-100">Log Weld</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-surface-500 hover:text-surface-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Project *</label>
                <select
                  value={form.project_id}
                  onChange={e => set('project_id', e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="">Select project…</option>
                  {projects.map((p: { id: string; name: string }) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Weld ID *</label>
                <input
                  type="text"
                  value={form.weld_id_number}
                  onChange={e => set('weld_id_number', e.target.value)}
                  placeholder="e.g. W-001"
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 placeholder-surface-600 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Welder Stamp</label>
                <input
                  type="text"
                  value={form.welder_stamp}
                  onChange={e => set('welder_stamp', e.target.value)}
                  placeholder="e.g. ABS-234"
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 placeholder-surface-600 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-brand-500"
                >
                  {WELD_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={() => mutation.mutate()}
              disabled={!form.project_id || !form.weld_id_number || mutation.isPending}
              className={cn(
                'w-full mt-5 py-3 rounded-xl text-sm font-semibold transition-all',
                'bg-brand-500 text-white hover:bg-brand-400 active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {mutation.isPending ? 'Logging…' : 'Log Weld'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
