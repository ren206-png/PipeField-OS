// ============================================================
// useOrganization — reads organization from shared AuthProvider.
// No extra database query — org is fetched together with profile
// on login and cached in context.
// ============================================================
'use client'

import { useAuth } from './useAuth'

export function useOrganization() {
  const { organization, isLoading } = useAuth()

  return {
    organization,
    isLoading,
    organizationId: organization?.id ?? null,
  }
}
