'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { UpgradePrompt } from '@/components/billing/UpgradePrompt'

const projectSchema = z.object({
  name:           z.string().min(1, 'Project name is required').max(200),
  project_number: z.string().max(50).optional(),
  description:    z.string().max(2000).optional(),
  client_name:    z.string().max(200).optional(),
  location:       z.string().max(300).optional(),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  status:         z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
})

type ProjectFormValues = z.infer<typeof projectSchema>

interface PlanLimitError {
  code:    'PLAN_LIMIT_EXCEEDED'
  error:   string
  limit:   number
  current: number
  plan:    string
}

export default function NewProjectPage() {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const [error,      setError]      = useState<string | null>(null)
  const [limitError, setLimitError] = useState<PlanLimitError | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver:      zodResolver(projectSchema),
    defaultValues: { status: 'active' },
  })

  async function onSubmit(values: ProjectFormValues) {
    setError(null)
    setLimitError(null)

    try {
      const res = await fetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(values),
      })

      const json = await res.json()

      if (!res.ok) {
        if (json?.code === 'PLAN_LIMIT_EXCEEDED') {
          setLimitError(json as PlanLimitError)
          return
        }
        throw new Error(json?.error ?? `HTTP ${res.status}`)
      }

      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] })
      router.push('/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Link
          href="/projects"
          className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">New Project</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Projects group welds, spools, and crew together
          </p>
        </div>
      </div>

      {/* ── Plan limit hit ── */}
      {limitError && (
        <UpgradePrompt
          feature="Projects"
          limit={limitError.limit}
          currentPlan={limitError.plan}
        />
      )}

      {/* ── Generic error ── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!limitError && (
        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">

          {/* Name + Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Project Name *</label>
              <input
                {...register('name')}
                className="input"
                placeholder="e.g. Refinery Unit 5 Turnaround"
              />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Project #</label>
              <input
                {...register('project_number')}
                className="input font-mono"
                placeholder="PRJ-001"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Client + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Client / Owner</label>
              <input
                {...register('client_name')}
                className="input"
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="label">Site Location</label>
              <input
                {...register('location')}
                className="input"
                placeholder="Plant, city, or coordinates"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" {...register('start_date')} className="input" />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" {...register('end_date')} className="input" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              className="input min-h-[80px] resize-y"
              placeholder="Scope, contract details, special requirements…"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3 text-base"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Creating…</>
              : 'Create Project'
            }
          </button>
        </form>
      )}
    </div>
  )
}
