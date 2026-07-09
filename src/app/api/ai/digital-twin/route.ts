// POST /api/ai/digital-twin
// Invokes the 'digital-twin' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('digital-twin')
