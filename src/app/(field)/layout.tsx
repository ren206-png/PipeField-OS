// ============================================================
// Field Mode Layout
// - Checks PFOS_FIELD_MODE flag (server-side via flags.ts)
// - Checks caller role: pipefitter / shop_fabricator → enter
//   foreman / qa_inspector / administrator / organization_owner / project_manager → show toggle
//   Others (client_viewer, platform_admin) → not redirected here
// - platform_admin always allowed (for verify console)
// ============================================================
import { redirect } from 'next/navigation'
import { getCallerProfile } from '@/lib/api-auth'
import { FLAGS } from '@/intelligence/flags'

export const FIELD_DEFAULT_ROLES = ['pipefitter', 'shop_fabricator'] as const
export const FIELD_TOGGLE_ROLES  = ['foreman', 'qa_inspector', 'administrator', 'organization_owner', 'project_manager'] as const

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  if (!FLAGS.PFOS_FIELD_MODE) {
    redirect('/dashboard')   // flag is off → back to main dashboard
  }

  const caller = await getCallerProfile()
  if (!caller) redirect('/login')

  // platform_admin always passes (for verify console)
  // All other roles are allowed into the layout; individual pages gate further
  return (
    <div className="field-layout min-h-screen bg-surface-950">
      {children}
    </div>
  )
}
