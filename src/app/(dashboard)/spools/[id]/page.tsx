// ============================================================
// Spool Detail — Server Component
//
// Fetches spool + items on the server so the page renders with
// content immediately. Interactive logic lives in SpoolDetailClient.
// Uses admin client so server render never fails due to cookie issues;
// the organization_id check below is what keeps that read tenant-scoped
// since the admin client bypasses RLS.
// ============================================================
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCallerProfile } from '@/lib/api-auth'
import { SpoolDetailClient } from '@/components/spools/SpoolDetailClient'
import type { SpoolWithRelations } from '@/types'

interface PageProps {
  params: { id: string }
}

export default async function SpoolDetailPage({ params }: PageProps) {
  try {
    const caller = await getCallerProfile()
    // Fail-closed: missing auth OR null organization_id → 404 before any query
    if (!caller || !caller.organization_id) notFound()

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('spools')
      .select('*, projects(name), spool_items(*)')
      .eq('id', params.id)
      .eq('organization_id', caller.organization_id)
      .single()

    if (error || !data) notFound()

    return <SpoolDetailClient id={params.id} initialData={data as SpoolWithRelations} />
  } catch {
    notFound()
  }
}
