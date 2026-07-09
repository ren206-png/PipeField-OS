// POST /api/ai/fabrication-planning
// Invokes the 'fabrication-planning' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('fabrication-planning')
