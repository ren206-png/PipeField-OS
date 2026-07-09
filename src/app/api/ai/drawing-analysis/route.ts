// POST /api/ai/drawing-analysis
// Invokes the 'drawing-analysis' Intelligence Engine capability.
// Auth: requireAuth → role check → engine tier gate → adapter
import { makeAiRoute } from '@/lib/ai-route'

export const dynamic = 'force-dynamic'
export const POST = makeAiRoute('drawing-analysis')
