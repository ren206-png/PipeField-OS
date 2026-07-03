'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useWeld } from '@/hooks/useWelds'
import { WeldForm, type WeldFormValues } from '@/components/welds/WeldForm'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useWpsList } from '@/hooks/useWps'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

interface PageProps {
  params: { id: string }
}

export default function EditWeldPage({ params }: PageProps) {
  const { id }        = params
  const router        = useRouter()
  const { profile }   = useAuth()
  const queryClient   = useQueryClient()
  const { data: weld, isLoading } = useWeld(id)
  const { data: projects }        = useProjects()
  const { data: wpsList = [] }    = useWpsList()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSubmit(values: WeldFormValues) {
    if (!profile) return
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateErr } = await supabase
        .from('welds')
        .update({
          project_id:     values.project_id,
          welder_stamp:   values.welder_stamp.toUpperCase(),
          welder_name:    values.welder_name,
          weld_date:      values.weld_date,
          spool_number:   values.spool_number   || null,
          line_number:    values.line_number    || null,
          pipe_size:      values.pipe_size      || null,
          wall_thickness: values.wall_thickness || null,
          material:       values.material       || null,
          weld_process:   values.weld_process   || null,
          wps_id:         values.wps_id         || null,
          notes:          values.notes          || null,
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      // Write audit entry
      await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        table_name:      'welds',
        record_id:       id,
        action:          'UPDATE',
        performed_by:    profile.id,
        notes:           'Weld details updated',
      })

      queryClient.invalidateQueries({ queryKey: ['weld', id] })
      router.push(`/welds/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingSpinner />

  if (!weld) {
    return (
      <div className="text-center py-24">
        <p className="text-surface-400">Weld not found.</p>
        <Link href="/welds" className="btn-ghost mt-4 inline-flex">← Back</Link>
      </div>
    )
  }

  const defaultValues: Partial<WeldFormValues> = {
    project_id:     weld.project_id,
    welder_stamp:   weld.welder_stamp ?? '',
    welder_name:    weld.welder_name  ?? '',
    weld_date:      weld.weld_date    ?? '',
    spool_number:   weld.spool_number ?? '',
    line_number:    (weld as unknown as { line_number?: string }).line_number  ?? '',
    pipe_size:      (weld as unknown as { pipe_size?: string }).pipe_size      ?? '',
    wall_thickness: (weld as unknown as { wall_thickness?: string }).wall_thickness ?? '',
    material:       (weld as unknown as { material?: string }).material        ?? '',
    weld_process:   (weld as unknown as { weld_process?: string }).weld_process ?? '',
    wps_id:         (weld as unknown as { wps_id?: string | null }).wps_id ?? null,
    notes:          weld.notes        ?? '',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Link
          href={`/welds/${id}`}
          className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">
            Edit {weld.weld_id_number}
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Update weld details — status is changed from the weld detail page
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="card p-6">
        <WeldForm
          projects={projects ?? []}
          wpsList={wpsList}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          isLoading={isSubmitting}
        />
      </div>
    </div>
  )
}
