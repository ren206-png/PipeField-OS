import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Redirect to the canonical billing page under /settings/billing
// which has the full 4-tier pricing UI.
export default async function BillingRedirectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  redirect('/settings/billing')
}
