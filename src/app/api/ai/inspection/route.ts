// POST /api/ai/inspection
// Invokes the 'inspection' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
// DEAD ROUTE: no frontend callers; UI page not yet implemented.
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('inspection')
