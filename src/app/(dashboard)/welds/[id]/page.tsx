// ============================================================
// Weld Detail — Server Component
//
// Fetches weld data on the server so the page renders with
// content immediately (no loading skeleton on first visit).
// Interactive logic lives in WeldDetailClient.
// Uses admin client so server render never fails due to cookie issues.
// ============================================================
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { WeldDetailClient } from '@/components/welds/WeldDetailClient'

interface PageProps {
  params: { id: string }
}

async function fetchWeldServer(id: string) {
  const admin = createAdminClient()

  const [weldRes, photosRes, auditRes] = await Promise.all([
    admin
      .from('welds')
      .select('*, projects(name), spools(spool_number)')
      .eq('id', id)
      .single(),
    admin
      .from('weld_photos')
      .select('*')
      .eq('weld_id', id)
      .order('created_at', { ascending: true }),
    admin
      .from('audit_logs')
      .select('*, user_profiles(full_name)')
      .eq('table_name', 'welds')
      .eq('record_id', id)
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
    const initialData = await fetchWeldServer(params.id)
    if (!initialData) notFound()
    return <WeldDetailClient id={params.id} initialData={initialData} />
  } catch {
    notFound()
  }
}
