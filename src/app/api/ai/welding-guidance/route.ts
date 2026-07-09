// POST /api/ai/welding-guidance
// Invokes the 'welding-guidance' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('welding-guidance')
