// POST /api/ai/pipefitter-assistant
// Invokes the 'pipefitter-assistant' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('pipefitter-assistant')
