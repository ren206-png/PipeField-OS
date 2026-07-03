'use client'
// ============================================================
// AuthProvider — single source of truth for auth + org state.
// Fetches user, profile, AND organization in ONE batch so the
// sidebar never shows "Loading…" after initial render.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Organization } from '@/types'

interface AuthState {
  user:            User | null
  profile:         UserProfile | null
  organization:    Organization | null
  isLoading:       boolean
  isAuthenticated: boolean
  isPlatformAdmin: boolean
  isOrgOwner:      boolean
  isOrgAdmin:      boolean
  canManageUsers:  boolean
}

interface AuthContextValue extends AuthState {
  signOut:        () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function deriveFlags(profile: UserProfile | null) {
  const role = profile?.role
  return {
    isPlatformAdmin: role === 'platform_admin',
    isOrgOwner:      role === 'organization_owner',
    isOrgAdmin:      role === 'platform_admin' || role === 'organization_owner' || role === 'administrator',
    canManageUsers:  role === 'platform_admin' || role === 'organization_owner' || role === 'administrator',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Stable Supabase client — created once, never recreated on re-render
  const supabase = useRef(createClient()).current

  const [state, setState] = useState<AuthState>({
    user:            null,
    profile:         null,
    organization:    null,
    isLoading:       true,
    isAuthenticated: false,
    isPlatformAdmin: false,
    isOrgOwner:      false,
    isOrgAdmin:      false,
    canManageUsers:  false,
  })

  // Fetch profile + org via /api/me (server-side admin client)
  // This avoids browser→Supabase REST latency/blocking issues entirely.
  const fetchProfileAndOrg = useCallback(async (user: User) => {
    try {
      const ac = new AbortController()
      const timeout = setTimeout(() => ac.abort(), 8_000)

      let p: UserProfile | null = null
      let org: Organization | null = null

      try {
        const res = await fetch('/api/me', { signal: ac.signal, credentials: 'same-origin' })
        if (res.ok) {
          const json = await res.json()
          p   = json.profile      as UserProfile   | null
          org = json.organization as Organization  | null
        }
      } finally {
        clearTimeout(timeout)
      }

      setState({
        user,
        profile:         p,
        organization:    org,
        isLoading:       false,
        isAuthenticated: true,
        ...deriveFlags(p),
      })
    } catch (err) {
      console.error('[AuthProvider] fetchProfileAndOrg failed:', err)
      setState(prev => ({ ...prev, user, isLoading: false, isAuthenticated: true }))
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await fetchProfileAndOrg(user)
    } catch (err) {
      console.error('[AuthProvider] refreshProfile failed:', err)
    }
  }, [supabase, fetchProfileAndOrg])

  useEffect(() => {
    let initialized = false

    // ── Hard timeout: always clear isLoading after 6 s regardless of state.
    // The previous guard (`if (!initialized)`) meant the timeout was a no-op
    // whenever getSession() resolved quickly but fetchProfileAndOrg then hung
    // (e.g. a slow / stalled Supabase REST query). Now we unconditionally
    // clear the flag so the UI never freezes on the skeleton indefinitely.
    const timeout = setTimeout(() => {
      console.warn('[AuthProvider] timeout — clearing isLoading')
      initialized = true
      setState(prev => ({ ...prev, isLoading: false }))
    }, 6_000)

    // ── Bootstrap: immediately check the current session.
    // onAuthStateChange fires asynchronously; getSession() resolves right away
    // and ensures the first render already has the correct auth state.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialized) return   // onAuthStateChange already handled it
      if (session?.user) {
        initialized = true
        void fetchProfileAndOrg(session.user)
      } else {
        initialized = true
        clearTimeout(timeout)
        setState({
          user:            null,
          profile:         null,
          organization:    null,
          isLoading:       false,
          isAuthenticated: false,
          isPlatformAdmin: false,
          isOrgOwner:      false,
          isOrgAdmin:      false,
          canManageUsers:  false,
        })
      }
    }).catch(err => {
      console.error('[AuthProvider] getSession failed:', err)
      setState(prev => ({ ...prev, isLoading: false }))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          if (!initialized || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            initialized = true
            clearTimeout(timeout)
            await fetchProfileAndOrg(session.user)
          }
        } else {
          initialized = true
          clearTimeout(timeout)
          setState({
            user:            null,
            profile:         null,
            organization:    null,
            isLoading:       false,
            isAuthenticated: false,
            isPlatformAdmin: false,
            isOrgOwner:      false,
            isOrgAdmin:      false,
            canManageUsers:  false,
          })
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfileAndOrg])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}
