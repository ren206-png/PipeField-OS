'use client'
import { useNativeApp } from '@/hooks/useNativeApp'

// Thin wrapper so we can call the hook inside the client tree.
// Drop this inside the root layout (already a server component).
export function NativeAppProvider({ children }: { children: React.ReactNode }) {
  useNativeApp()
  return <>{children}</>
}
