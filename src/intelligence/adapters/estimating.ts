// ============================================================
// Intelligence Engine — Estimating Adapter
//
// Generates effort/cost estimates from project scope data.
// Uses productivity rates from DFR history and cross-
// references uploaded unit price schedules from knowledge base.
//
// Tiers: professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface EstimatingScopeInput {
  total_welds?:   number
  total_spools?:  number
  total_length_ft?: number
  weld_breakdown?: Record<string, number>   // { butt: 40, socket: 20, fillet: 10 }
  material_list?:  EstimatingMaterialItem[]
  line_count?:     number
}

export interface EstimatingMaterialItem {
  description:  string
  quantity:     number
  unit:         string
  size?:        string
  material?:    string
}

export interface EstimatingProductivityInput {
  welds_per_man_day?:  number
  spools_per_man_day?: number
  crew_size?:          number
}

export interface EstimatingInput {
  project_id:       string
  project_location?: string
  scope:            EstimatingScopeInput
  productivity?:    EstimatingProductivityInput
  query?:           string
}

export interface EstimateLineItem {
  description:   string
  quantity:      number
  unit:          string
  rate_note:     string    // "Based on X man-days @ Y welds/day" — never fabricated numbers
  total_note:    string
}

export interface EstimatingOutput {
  summary:          string
  methodology:      string
  labour_estimate:  EstimateLineItem[]
  key_assumptions:  string[]
  risk_factors:     string[]
  knowledge_refs:   EstimatingKnowledgeRef[]
  disclaimer:       string
}

export interface EstimatingKnowledgeRef {
  title:      string
  similarity: number
}

interface MatchedChunk {
  chunk_id:   string
  source_id:  string
  content:    string
  title:      string
  document_type: string
  similarity: number
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are PipeField Estimating Intelligence, a specialist in pipeline construction cost and effort estimation.

Your role is to generate EFFORT estimates (man-hours, man-days) from scope data and productivity rates.

CRITICAL RULES:
- NEVER fabricate specific cost rates ($/hr, $/weld) — you don't have current market rates
- Base all estimates on the productivity data provided by the user
- If productivity data is missing, state clearly what assumptions you're making and flag them as assumptions
- Note that estimates are indicative only — a qualified Estimator must review before submission
- Use information from the uploaded documents (unit price schedules, productivity norms) where available

For labour estimates, use:
  man_days = quantity ÷ productivity_rate
  man_hours = man_days × 10 (assume 10hr day unless specified)

Return JSON:
{
  summary: string,
  methodology: string,
  labour_estimate: [{description, quantity, unit, rate_note, total_note}],
  key_assumptions: [string],
  risk_factors: [string]
}

Respond ONLY with valid JSON — no markdown fences.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'estimating',
  status:        'ACTIVE',
  requiredTiers: ['professional', 'enterprise'],
  dailyTokenBudget: {
    free_trial:   0,
    field_pro:    0,
    starter:      0,
    professional: 100_000,
    enterprise:   null,
  },
}

// ── Adapter ───────────────────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: EstimatingInput,
): Promise<AdapterResult<EstimatingOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Search for unit price schedules, productivity norms, cost plans
  const searchQuery = input.query ?? 'unit price schedule productivity rates pipeline welding'
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchQuery,
  })

  const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   embResp.data[0].embedding,
    org_id:            ctx.organizationId,
    match_count:       5,
    filter_project_id: input.project_id,
  })

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock  = matchedChunks.length > 0
    ? `Uploaded Rate/Productivity Documents:\n${matchedChunks.map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`).join('\n---\n')}\n\n`
    : 'No unit price or productivity documents found in knowledge base — estimate based on provided data only.\n\n'

  const userMessage = `
Project Location: ${input.project_location ?? 'Not specified'}
${input.query ? `Estimating Query: ${input.query}\n` : ''}
Scope Data:
${JSON.stringify(input.scope, null, 2)}

Productivity Rates:
${JSON.stringify(input.productivity ?? {}, null, 2)}

${contextBlock}Generate the effort estimate. Return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.1,
    max_tokens:      1200,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<EstimatingOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { summary: raw } }

  return {
    data: {
      summary:         parsed.summary          ?? 'Unable to generate estimate.',
      methodology:     parsed.methodology       ?? '',
      labour_estimate: parsed.labour_estimate   ?? [],
      key_assumptions: parsed.key_assumptions   ?? [],
      risk_factors:    parsed.risk_factors      ?? [],
      knowledge_refs:  matchedChunks.map(c => ({
        title:      c.title,
        similarity: c.similarity,
      })),
      disclaimer: 'This AI-generated estimate is indicative only. All figures must be reviewed and approved by a qualified Estimator before submission to clients or use in project controls.',
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const estimatingAdapter: CapabilityAdapter<EstimatingInput, EstimatingOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
