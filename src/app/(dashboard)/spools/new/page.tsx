'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SpoolForm, type SpoolFormValues } from '@/components/spools/SpoolForm'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export default function NewSpoolPage() {
  const router       = useRouter()
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [debugInfo,    setDebugInfo]    = useState<string | null>(null)

  async function handleSubmit(values: SpoolFormValues) {
    if (!profile?.organization_id) {
      setError('Profile not loaded — please refresh and try again.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    setDebugInfo(null)

    try {
      const supabase = createClient()

      // ── Step 1: insert spool ──────────────────────────────
      const { data, error: insertErr } = await supabase
        .from('spools')
        .insert({
          organization_id: profile.organization_id,
          project_id:      values.project_id,
          spool_number:    values.spool_number.toUpperCase(),
          status:          'designed',
          created_by:      profile.id,
        })
        .select('id')
        .single()

      if (insertErr) {
        // Show full Supabase error details for diagnosis
        setDebugInfo(
          `Code: ${insertErr.code}\nMessage: ${insertErr.message}\nDetails: ${insertErr.details ?? '—'}\nHint: ${insertErr.hint ?? '—'}\n\nProfile org_id: ${profile.organization_id}\nProfile id: ${profile.id}`
        )
        throw new Error(insertErr.message)
      }

      // ── Step 2: audit log (best-effort — don't block on failure) ──
      await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        table_name:      'spools',
        record_id:       data!.id,
        action:          'INSERT',
        new_values:      { status: 'designed', spool_number: values.spool_number },
        performed_by:    profile.id,
      }).then(({ error: auditErr }) => {
        if (auditErr) console.warn('[audit_log] non-fatal:', auditErr.message)
      })

      queryClient.invalidateQueries({ queryKey: ['spools'] })
      router.push(`/spools/${data!.id}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create spool')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/spools"
          className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">New Spool</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Starts in &quot;Designed&quot; status — advance as fabrication progresses
          </p>
        </div>
      </div>

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

      <div className="card p-6">
        {loadingProjects ? (
          <div className="text-center py-12 text-surface-500">Loading projects…</div>
        ) : !projects?.length ? (
          <div className="text-center py-12">
            <p className="text-surface-400 mb-4">You need a project before creating a spool.</p>
            <Link href="/projects/new" className="btn-primary">Create a Project</Link>
          </div>
        ) : (
          <SpoolForm
            projects={projects}
            onSubmit={handleSubmit}
            submitLabel="Create Spool"
            isLoading={isSubmitting}
          />
        )}
      </div>
    </div>
  )
}
