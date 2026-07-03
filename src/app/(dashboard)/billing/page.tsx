import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BILLING_PLANS } from '@/lib/stripe'
import { PricingCard } from '@/components/billing/PricingCard'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, organizations(plan, stripe_customer_id)')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const org = profile?.organizations as unknown as { plan: string; stripe_customer_id: string | null } | null
  const currentPlan = org?.plan ?? 'free'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-surface-50 mb-2">Billing &amp; Plans</h1>
      <p className="text-surface-400 mb-8">Current plan: <span className="text-brand-400 font-semibold capitalize">{currentPlan}</span></p>

      <div className="grid sm:grid-cols-3 gap-6">
        {[
          { key: 'free' as const, features: ['1 project', '50 welds', '6 field calculators', 'Basic reports'] },
          { key: 'pro' as const, features: ['10 projects', 'Unlimited welds', 'All calculators', 'QA packages', 'PDF exports', 'Smart alerts'] },
          { key: 'enterprise' as const, features: ['Unlimited projects', 'Unlimited welds', 'Priority support', 'Custom integrations', 'Digital signatures', 'Executive reports'] },
        ].map(({ key, features }) => (
          <PricingCard
            key={key}
            plan={key}
            planData={BILLING_PLANS[key]}
            features={features}
            isCurrentPlan={currentPlan === key}
            organizationId={profile?.organization_id ?? ''}
          />
        ))}
      </div>
    </div>
  )
}
