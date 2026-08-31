// ============================================================
// Field Mode — Today Page (server component)
// Shows spools/joints assigned to the current user's crew.
// Queries: spools where assigned_crew contains caller,
//          welds for those spools in status fit_up or earlier.
// Spool sequence: sorted by priority column (Phase 0 schema).
// ============================================================
import { redirect } from 'next/navigation'
import { getCallerProfile } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface Spool {
  id: string
  spool_number: string | null
  priority: number | null
  status: string | null
}

interface Weld {
  id: string
  joint_number: string | null
  status: string | null
  spool_id: string
}

export default async function TodayPage() {
  const caller = await getCallerProfile()
  if (!caller) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* Server Component */ }
        },
      },
    }
  )

  // Fetch spools assigned to this user's crew (by name or ID)
  // Priority column governs the sequence (Phase 0 schema finding)
  const { data: spools } = await supabase
    .from('spools')
    .select('id, spool_number, priority, status')
    .eq('organization_id', caller.organization_id ?? '')
    .or(`assigned_crew.cs.{${caller.id}},assigned_crew.cs.{${caller.full_name ?? ''}}`)
    .order('priority', { ascending: true })
    .limit(50)

  const spoolList = (spools ?? []) as Spool[]
  const spoolIds = spoolList.map(s => s.id)

  // Fetch open joints for those spools
  const { data: welds } = spoolIds.length > 0
    ? await supabase
        .from('welds')
        .select('id, joint_number, status, spool_id')
        .in('spool_id', spoolIds)
        .in('status', ['pending', 'fit_up', 'not_started'])
        .order('joint_number')
    : { data: [] }

  const weldList = (welds ?? []) as Weld[]

  // Group welds by spool
  const weldsBySpool = new Map<string, Weld[]>()
  for (const w of weldList) {
    const group = weldsBySpool.get(w.spool_id) ?? []
    group.push(w)
    weldsBySpool.set(w.spool_id, group)
  }

  return (
    <div className="min-h-screen bg-surface-950 p-4">
      <h1 className="text-xl font-bold text-surface-100 mb-6">Today</h1>

      {spoolList.length === 0 && (
        <p className="text-surface-500 text-sm">No spools assigned to you today.</p>
      )}

      <div className="flex flex-col gap-3">
        {spoolList.map((spool) => {
          const openWelds = weldsBySpool.get(spool.id) ?? []
          return (
            <div key={spool.id} className="rounded-2xl border border-surface-700 bg-surface-900 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-surface-100 font-semibold">
                    Spool #{spool.spool_number ?? spool.id.slice(0, 8)}
                  </p>
                  <p className="text-surface-500 text-xs mt-0.5">{spool.status ?? '—'}</p>
                </div>
                {spool.priority != null && (
                  <span className="px-2 py-0.5 rounded-full bg-surface-800 text-surface-400 text-xs">
                    P{spool.priority}
                  </span>
                )}
              </div>

              {openWelds.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Open Joints</p>
                  {openWelds.map(w => (
                    <div key={w.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-800">
                      <span className="text-surface-200 text-sm font-mono">
                        Joint #{w.joint_number ?? w.id.slice(0, 8)}
                      </span>
                      <span className="text-surface-500 text-xs">{w.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {openWelds.length === 0 && (
                <p className="mt-2 text-surface-600 text-xs">No open joints</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
