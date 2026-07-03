'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { WorkerList } from '@/components/organization/WorkerList'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import Link from 'next/link'

const ORG_ADMIN_ROLES = ['platform_admin', 'organization_owner', 'administrator']

export default function WorkersPage() {
  const { profile, isLoading } = useAuth()
  const { organization }       = useOrganization()
  const router                 = useRouter()

  // Field Pro is a 1-seat individual plan — no team management needed.
  useEffect(() => {
    if (!isLoading && organization?.subscription_tier === 'field_pro') {
      router.replace('/dashboard')
    }
  }, [isLoading, organization?.subscription_tier, router])

  if (isLoading) return <LoadingSpinner />

  // Redirect in progress — render nothing
  if (organization?.subscription_tier === 'field_pro') return null

  if (!profile || !ORG_ADMIN_ROLES.includes(profile.role)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-lg font-bold text-surface-50">Access Restricted</h2>
        <p className="text-sm text-surface-400">
          Only organization administrators can manage team members.
        </p>
        <Link href="/dashboard" className="btn-primary inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Team Members</h1>
        <p className="text-sm text-surface-500 mt-1">
          Manage workers in your organization — invite, change roles, or deactivate accounts.
        </p>
      </div>

      <WorkerList />
    </div>
  )
}
