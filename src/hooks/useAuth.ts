// ============================================================
// useAuth — reads from the shared AuthProvider context.
// No database calls here — all data comes from the single
// fetch that AuthProvider does at app startup.
// ============================================================
'use client'

export { useAuthContext as useAuth } from '@/providers/AuthProvider'
