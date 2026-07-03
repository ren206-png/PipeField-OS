'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const schema = z.object({
  name:           z.string().min(1, 'Project name is required').max(200),
  project_number: z.string().max(50).optional(),
  description:    z.string().max(2000).optional(),
  client_name:    z.string().max(200).optional(),
  location:       z.string().max(300).optional(),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  status:         z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
})
type FormValues = z.infer<typeof schema>

interface PageProps { params: { id: string } }

export default function EditProjectPage({ params }: PageProps) {
  const { id }       = params
  const router       = useRouter()
  const { profile }  = useAuth()
  const qc           = useQueryClient()
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('projects').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (project) {
      reset({
        name:           project.name           ?? '',
        project_number: project.project_number ?? '',
        description:    project.description    ?? '',
        client_name:    project.client_name    ?? '',
        location:       project.location       ?? '',
        start_date:     project.start_date     ?? '',
        end_date:       project.end_date       ?? '',
        status:         project.status         ?? 'active',
      })
    }
  }, [project, reset])

  const update = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await createClient()
        .from('projects')
        .update({
          name:           values.name,
          project_number: values.project_number  || null,
          description:    values.description     || null,
          client_name:    values.client_name     || null,
          location:       values.location        || null,
          start_date:     values.start_date      || null,
          end_date:       values.end_date        || null,
          status:         values.status,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', profile?.organization_id] })
      qc.invalidateQueries({ queryKey: ['project', id] })
      router.push('/projects')
    },
  })

  if (isLoading) return <LoadingSpinner />

  if (!project) return (
    <div className="text-center py-24 text-surface-400">
      Project not found.{' '}
      <Link href="/projects" className="text-brand-400 hover:underline">Back to Projects</Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/projects" className="p-2 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Edit Project</h1>
          <p className="text-sm text-surface-500">{project.name}</p>
        </div>
      </div>

      {update.isError && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-red-300 text-sm">
          {(update.error as Error)?.message ?? 'Failed to save changes.'}
        </div>
      )}

      <form onSubmit={handleSubmit(v => update.mutate(v))} className="card p-6 space-y-5">

        {/* Name */}
        <div>
          <label className="label">Project Name *</label>
          <input className={errors.name ? 'input-error' : 'input'} {...register('name')} />
          {errors.name && <p className="error-message">{errors.name.message}</p>}
        </div>

        {/* Number + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Project Number</label>
            <input className="input" placeholder="PRJ-001" {...register('project_number')} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" {...register('status')}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Client + Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Client Name</label>
            <input className="input" placeholder="ABC Corp" {...register('client_name')} />
          </div>
          <div>
            <label className="label">Location / Site</label>
            <input className="input" placeholder="Houston, TX" {...register('location')} />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" {...register('start_date')} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" {...register('end_date')} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <textarea
            rows={4}
            className="input resize-none"
            placeholder="Scope of work, special requirements…"
            {...register('description')}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-700">
          <Link href="/projects" className="btn-ghost">Cancel</Link>
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="btn-primary flex items-center gap-2"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Changes</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
