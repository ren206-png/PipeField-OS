'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WeldForm, type WeldFormValues } from '@/components/welds/WeldForm'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useWpsList } from '@/hooks/useWps'
import { createClient } from '@/lib/supabase/client'

export default function NewWeldPage() {
  const router    = useRouter()
  const { profile } = useAuth()
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const { data: wpsList = [] } = useWpsList()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  async function handleSubmit(values: WeldFormValues) {
    if (!profile?.organization_id) return
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // Auto-generate next weld ID: count existing welds for this project
      const { count } = await supabase
        .from('welds')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', values.project_id)
      const weldIdNumber = `W-${String((count ?? 0) + 1).padStart(4, '0')}`

      const { data, error: insertErr } = await supabase
        .from('welds')
        .insert({
          organization_id: profile.organization_id,
          project_id:      values.project_id,
          weld_id_number:  weldIdNumber,
          status:          'draft',
          welder_stamp:    values.welder_stamp?.toUpperCase() || null,
          welder_name:     values.welder_name  || null,
          weld_date:       values.weld_date    || null,
          notes:           values.notes        || null,
          wps_id:          values.wps_id       || null,
          created_by:      profile.id,
        })
        .select('id')
        .single()

      if (insertErr) {
        setDebugInfo(
          `Code: ${insertErr.code}\nMessage: ${insertErr.message}\nDetails: ${insertErr.details ?? '—'}\nHint: ${insertErr.hint ?? '—'}`
        )
        throw new Error(insertErr.message)
      }

      // Write audit log (best-effort — don't block navigation on failure)
      supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        table_name:      'welds',
        record_id:       data.id,
        action:          'INSERT',
        new_values:      { status: 'draft', weld_id_number: weldIdNumber },
        performed_by:    profile.id,
      }).then(({ error: e }) => { if (e) console.warn('[audit]', e.message) })

      router.push(`/welds/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create weld')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Link
          href="/welds"
          className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Log New Weld</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            A weld ID will be auto-generated for the selected project
          </p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm space-y-2">
          <p className="font-semibold">{error}</p>
          {debugInfo && (
            <pre className="text-xs text-red-300/80 whitespace-pre-wrap font-mono bg-red-950/30 p-3 rounded-lg">
              {debugInfo}
            </pre>
          )}
        </div>
      )}

      {/* ── Form ── */}
      <div className="card p-6">
        {loadingProjects ? (
          <div className="text-center py-12 text-surface-500">Loading projects…</div>
        ) : !projects?.length ? (
          <div className="text-center py-12">
            <p className="text-surface-400 mb-4">You need a project before logging a weld.</p>
            <Link href="/projects/new" className="btn-primary">
              Create a Project
            </Link>
          </div>
        ) : (
          <WeldForm
            projects={projects}
            wpsList={wpsList}
            onSubmit={handleSubmit}
            submitLabel="Log Weld"
            isLoading={isSubmitting}
          />
        )}
      </div>
    </div>
  )
}
