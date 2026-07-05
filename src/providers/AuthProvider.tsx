'use client'
// ============================================================
// AuthProvider — single source of truth for auth + org state.
//
// KEY DESIGN RULES (do not break these):
//
// 1. fetchProfileAndOrg NEVER calls supabase.auth.getSession()
//    internally. Calling getSession() inside onAuthStateChange
//    causes a deadlock — Supabase holds an internal lock during
//    auth state changes and re-entering it hangs indefinitely.
//    The access token is always passed in from the call site.
//
// 2. onAuthStateChange is the single source of truth for the
//    initial session. getSession() is only used as a fast-path
//    fallback in case onAuthStateChange fires late.
//
// 3. A hard 5-second timeout unconditionally clears isLoading
//    so the UI never freezes regardless of network state.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

const SIGNED_OUT_STATE: AuthState = {
  user:            null,
  profile:         null,
  organization:    null,
  isLoading:       false,
  isAuthenticated: false,
  isPlatformAdmin: false,
  isOrgOwner:      false,
  isOrgAdmin:      false,
  canManageUsers:  false,
}

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
  const supabase = useRef(createClient()).current

  const [state, setState] = useState<AuthState>({
    ...SIGNED_OUT_STATE,
    isLoading: true,   // start loading until first auth event resolves
  })

  // ── Core fetch ───────────────────────────────────────────────
  // accessToken is passed in from the caller — NEVER call
  // supabase.auth.getSession() from inside this function.
  // See design rule #1 above.
  const fetchProfileAndOrg = useCallback(async (
    user:        User,
    accessToken: string | null,
  ) => {
    const ac          = new AbortController()
    const abortTimer  = setTimeout(() => ac.abort(), 5_000)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      // Retry up to 3× on 401 only — other errors exit immediately.
      let res: Response | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 300 * attempt))
        res = await fetch('/api/me', { signal: ac.signal, credentials: 'include', headers })
        if (res.ok || res.status !== 401) break
      }

      let p:   UserProfile  | null = null
      let org: Organization | null = null
      if (res?.ok) {
        const json = await res.json()
        p   = json.profile      as UserProfile   | null
        org = json.organization as Organization  | null
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
      // AbortError (timeout) or network failure — still resolve auth
      // with the user object so the page isn't permanently blocked.
      console.error('[AuthProvider] fetchProfileAndOrg failed:', err)
      setState(prev => ({ ...prev, user, isLoading: false, isAuthenticated: true }))
    } finally {
      clearTimeout(abortTimer)
    }
  }, [])

  // refreshProfile is called from settings/profile save —
  // it's safe to call getSession() here because we are NOT
  // inside an onAuthStateChange handler.
  const refreshProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await fetchProfileAndOrg(session.user, session.access_token)
      }
    } catch (err) {
      console.error('[AuthProvider] refreshProfile failed:', err)
    }
  }, [supabase, fetchProfileAndOrg])

  useEffect(() => {
    // initialized prevents both onAuthStateChange and getSession()
    // from both triggering fetchProfileAndOrg on the first load.
    let initialized = false

    // Hard timeout — always clears isLoading after 5s so the UI
    // never freezes regardless of network/Supabase state.
    const hardTimeout = setTimeout(() => {
      if (!initialized) {
        console.warn('[AuthProvider] hard timeout — clearing isLoading')
        initialized = true
      }
      setState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev)
    }, 5_000)

    // ── Primary: onAuthStateChange ──────────────────────────────
    // Supabase fires INITIAL_SESSION synchronously (or on the next
    // microtask) with the current session. This is the preferred
    // path because the session object already contains the access
    // token — no extra getSession() call needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Handle: first load (INITIAL_SESSION), sign-in, token refresh
          // Skip USER_UPDATED etc. if already initialized — no need to re-fetch
          if (!initialized || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            initialized = true
            clearTimeout(hardTimeout)
            await fetchProfileAndOrg(session.user, session.access_token)
          }
        } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          // Explicit sign-out OR confirmed no session on initial load
          initialized = true
          clearTimeout(hardTimeout)
          setState(SIGNED_OUT_STATE)
        }
        // All other events with no session (USER_DELETED etc.) — ignore;
        // signOut() triggers SIGNED_OUT which handles the redirect.
      }
    )

    // ── Fallback: getSession() ──────────────────────────────────
    // In rare cases onAuthStateChange fires late (e.g. slow Supabase
    // cold start). getSession() is a synchronous cache read that
    // resolves quickly and handles the gap.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialized) return   // onAuthStateChange already handled it
      if (session?.user) {
        initialized = true
        // Safe to call getSession() here — we are NOT inside
        // an onAuthStateChange handler at this point.
        void fetchProfileAndOrg(session.user, session.access_token)
      } else {
        initialized = true
        clearTimeout(hardTimeout)
        setState(SIGNED_OUT_STATE)
      }
    }).catch(err => {
      console.error('[AuthProvider] getSession fallback failed:', err)
      initialized = true
      setState(prev => ({ ...prev, isLoading: false }))
    })

    return () => {
      clearTimeout(hardTimeout)
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfileAndOrg])

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore — force redirect regardless
    }
    window.location.href = '/login'
  }

  const contextValue = useMemo<AuthContextValue>(
    () => ({ ...state, signOut, refreshProfile }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.user,
      state.profile,
      state.organization,
      state.isLoading,
      state.isAuthenticated,
      state.isPlatformAdmin,
      state.isOrgOwner,
      state.isOrgAdmin,
      state.canManageUsers,
    ]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}
