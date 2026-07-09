// POST /api/ai/qa-qc-assistance
// Invokes the 'qa-qc-assistance' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('qa-qc-assistance')
