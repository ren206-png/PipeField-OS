// ============================================================
// Spool Detail — Server Component
//
// Fetches spool + items on the server so the page renders with
// content immediately. Interactive logic lives in SpoolDetailClient.
// Uses admin client so server render never fails due to cookie issues.
// ============================================================
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { SpoolDetailClient } from '@/components/spools/SpoolDetailClient'
import type { SpoolWithRelations } from '@/types'

interface PageProps {
  params: { id: string }
}

export default async function SpoolDetailPage({ params }: PageProps) {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('spools')
      .select('*, projects(name), spool_items(*)')
      .eq('id', params.id)
      .single()

    if (error || !data) notFound()

    return <SpoolDetailClient id={params.id} initialData={data as SpoolWithRelations} />
  } catch {
    notFound()
  }
}
