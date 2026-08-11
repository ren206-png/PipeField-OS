// ============================================================
// Project Detail — Server Component
//
// Fetches project metadata on the server so the page header
// and tab structure render immediately without a skeleton.
// All tab data (welds, spools, NDE, etc.) loads client-side
// via React Query inside ProjectDetailClient.
//
// Uses the admin client for the initial fetch so the server
// render never fails due to a missing or expired session cookie;
// the organization_id check below is what keeps that read tenant-scoped
// since the admin client bypasses RLS.
// ============================================================
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCallerProfile } from '@/lib/api-auth'
import { ProjectDetailClient } from '@/components/projects/ProjectDetailClient'

interface PageProps {
  params: { id: string }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  try {
    const caller = await getCallerProfile()
    // Fail-closed: missing auth OR null organization_id → 404 before any query
    if (!caller || !caller.organization_id) notFound()

    const admin = createAdminClient()

    const { data: project, error } = await admin
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (error || !project) notFound()

    return (
      <ProjectDetailClient
        id={params.id}
        initialData={project as Record<string, unknown>}
      />
    )
  } catch {
    notFound()
  }
}
