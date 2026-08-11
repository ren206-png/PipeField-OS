// ============================================================
// Weld Detail — Server Component
//
// Fetches weld data on the server so the page renders with
// content immediately (no loading skeleton on first visit).
// Interactive logic lives in WeldDetailClient.
// Uses admin client so server render never fails due to cookie issues;
// the organization_id checks below are what keep those reads tenant-scoped
// since the admin client bypasses RLS.
// ============================================================
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCallerProfile } from '@/lib/api-auth'
import { WeldDetailClient } from '@/components/welds/WeldDetailClient'

interface PageProps {
  params: { id: string }
}

async function fetchWeldServer(id: string, organizationId: string) {
  const admin = createAdminClient()

  const [weldRes, photosRes, auditRes] = await Promise.all([
    admin
      .from('welds')
      .select('*, projects(name), spools(spool_number)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single(),
    admin
      .from('weld_photos')
      .select('*')
      .eq('weld_id', id)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
    admin
      .from('audit_logs')
      .select('*, user_profiles(full_name)')
      .eq('table_name', 'welds')
      .eq('record_id', id)
      .eq('organization_id', organizationId)
      .order('performed_at', { ascending: false }),
  ])

  if (weldRes.error || !weldRes.data) return null

  return {
    ...weldRes.data,
    photos:   photosRes.data ?? [],
    timeline: auditRes.data  ?? [],
  }
}

export default async function WeldDetailPage({ params }: PageProps) {
  try {
    const caller = await getCallerProfile()
    // Fail-closed: missing auth OR null organization_id → 404 before any query
    if (!caller || !caller.organization_id) notFound()

    const initialData = await fetchWeldServer(params.id, caller.organization_id)
    if (!initialData) notFound()
    return <WeldDetailClient id={params.id} initialData={initialData} />
  } catch {
    notFound()
  }
}
