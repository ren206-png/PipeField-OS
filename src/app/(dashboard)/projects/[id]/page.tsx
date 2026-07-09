// ============================================================
// Project Detail — Server Component
//
// Fetches project metadata on the server so the page header
// and tab structure render immediately without a skeleton.
// All tab data (welds, spools, NDE, etc.) loads client-side
// via React Query inside ProjectDetailClient.
//
// Uses the admin client for the initial fetch so the server
// render never fails due to a missing or expired session cookie.
// ============================================================
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjectDetailClient } from '@/components/projects/ProjectDetailClient'

interface PageProps {
  params: { id: string }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  try {
    const admin = createAdminClient()

    const { data: project, error } = await admin
      .from('projects')
      .select('*')
      .eq('id', params.id)
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
