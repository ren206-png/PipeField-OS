// POST /api/ai/safety-analysis
// Invokes the 'safety-analysis' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('safety-analysis')
