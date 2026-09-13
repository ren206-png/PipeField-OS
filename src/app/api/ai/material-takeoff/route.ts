// POST /api/ai/material-takeoff
// Invokes the 'material-takeoff' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
// DEAD ROUTE: capability marked NOT_IMPLEMENTED in intelligence/types.ts; no frontend callers as of 2026-09-13.
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('material-takeoff')
