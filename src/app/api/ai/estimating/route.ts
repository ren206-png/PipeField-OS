// POST /api/ai/estimating
// Invokes the 'estimating' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
// DEAD ROUTE: capability marked NOT_IMPLEMENTED in intelligence/types.ts; no frontend callers as of 2026-08-23.
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('estimating')
