'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSpool } from '@/hooks/useSpools'
import type { SpoolWithRelations } from '@/types'
import { SpoolForm, type SpoolFormValues } from '@/components/spools/SpoolForm'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

interface PageProps { params: { id: string } }

export default function EditSpoolPage({ params }: PageProps) {
  const { id }       = params
  const router       = useRouter()
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const { data: spool, isLoading } = useSpool(id)
  const { data: projects }         = useProjects()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSubmit(values: SpoolFormValues) {
    if (!profile) return
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateErr } = await supabase
        .from('spools')
        .update({
          project_id:      values.project_id,
          spool_number:    values.spool_number.toUpperCase(),
          revision:        values.revision        || 'A',
          pipe_size:       values.pipe_size       || null,
          pipe_schedule:   values.pipe_schedule   || null,
          material:        values.material        || null,
          service:         values.service         || null,
          design_pressure: values.design_pressure ? parseFloat(values.design_pressure) : null,
          design_temp:     values.design_temp     ? parseFloat(values.design_temp)     : null,
          total_length_in: values.total_length_in ? parseFloat(values.total_length_in) : null,
          isometric_ref:   values.isometric_ref   || null,
          area:            values.area            || null,
          priority:        values.priority        ? parseInt(values.priority)          : 5,
          notes:           values.notes           || null,
          required_date:   values.required_date   || null,
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        table_name:      'spools',
        record_id:       id,
        action:          'UPDATE',
        performed_by:    profile.id,
        notes:           'Spool details updated',
      })

      queryClient.invalidateQueries({ queryKey: ['spool',  id] })
      queryClient.invalidateQueries({ queryKey: ['spools'] })
      router.push(`/spools/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!spool) {
    return (
      <div className="text-center py-24">
        <p className="text-surface-400">Spool not found.</p>
        <Link href="/spools" className="btn-ghost mt-4 inline-flex">← Back</Link>
      </div>
    )
  }

  const s = spool as SpoolWithRelations

  const defaultValues: Partial<SpoolFormValues> = {
    project_id:      s.project_id,
    spool_number:    s.spool_number      ?? '',
    revision:        s.revision          ?? 'A',
    pipe_size:       s.pipe_size         ?? '',
    pipe_schedule:   s.pipe_schedule     ?? '',
    material:        s.material          ?? '',
    service:         s.service           ?? '',
    design_pressure: s.design_pressure   ? String(s.design_pressure)   : '',
    design_temp:     s.design_temp       ? String(s.design_temp)       : '',
    total_length_in: s.total_length_in   ? String(s.total_length_in)   : '',
    isometric_ref:   s.isometric_ref     ?? '',
    area:            s.area              ?? '',
    priority:        s.priority          ? String(s.priority)          : '5',
    required_date:   s.required_date     ?? '',
    notes:           s.notes             ?? '',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/spools/${id}`}
          className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Edit {s.spool_number}</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Status is advanced from the spool detail page
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="card p-6">
        <SpoolForm
          projects={projects ?? []}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          isLoading={isSubmitting}
        />
      </div>
    </div>
  )
}
