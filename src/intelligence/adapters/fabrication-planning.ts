// ============================================================
// Intelligence Engine — Fabrication Planning Adapter
//
// Recommends spool fabrication sequence based on priority,
// material availability, required dates, and crew productivity.
// Gated to professional+ tiers.
//
// Tiers: professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface FabSpoolInput {
  id?:              string
  spool_number?:    string
  status?:          string
  priority?:        number
  required_date?:   string
  pipe_size?:       string
  pipe_schedule?:   string
  material?:        string
  total_welds?:     number
  total_length_in?: number
  isometric_ref?:   string
  area?:            string
  items_count?:     number
}

export interface MilestoneInput {
  name?:          string
  planned_date?:  string
  actual_date?:   string | null
  status?:        string
}

export interface ProductivityInput {
  welds_per_day?:  number
  spools_per_day?: number
  crew_size?:      number
}

export interface FabricationPlanningInput {
  project_id:     string
  spools:         FabSpoolInput[]
  milestones?:    MilestoneInput[]
  productivity?:  ProductivityInput
  query?:         string
}

export interface FabSequenceItem {
  spool_number: string
  priority:     number
  reason:       string
  est_days?:    number
}

export interface FabricationPlanningOutput {
  summary:           string
  recommended_sequence: FabSequenceItem[]
  critical_path:     string[]
  risks:             string[]
  recommendations:   string[]
  knowledge_refs:    FabKnowledgeRef[]
}

export interface FabKnowledgeRef {
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
const SYSTEM_PROMPT = `You are PipeField Fabrication Intelligence, a fabrication planning specialist for pipeline construction.

Given the spool data, milestones, and productivity rates, recommend:
1. Optimal fabrication sequence (high-priority, critical-path spools first)
2. Which spools are on the critical path to milestone completion
3. Key risks (material shortages, specialty welds, long-lead items)
4. Practical recommendations to improve throughput

Sequencing priorities (in order):
1. Spools with earliest required_date
2. Spools with higher priority number (if provided)
3. Spools feeding critical milestones
4. Large-bore or high-weld-count spools (more shop time, schedule first)
5. Exotic material spools (require specialized welders — schedule early)

Return JSON:
{
  summary: string,
  recommended_sequence: [{spool_number, priority, reason, est_days?}],
  critical_path: [string],
  risks: [string],
  recommendations: [string]
}

Respond ONLY with valid JSON.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'fabrication-planning',
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
  input: FabricationPlanningInput,
): Promise<AdapterResult<FabricationPlanningOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Search for fabrication procedure / sequencing documents
  const searchQuery = input.query ?? 'fabrication sequence spool priority planning'
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchQuery,
  })

  const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   embResp.data[0].embedding,
    org_id:            ctx.organizationId,
    match_count:       4,
    filter_project_id: input.project_id,
  })

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock  = matchedChunks.length > 0
    ? `Project Procedure Documents:\n${matchedChunks.map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`).join('\n---\n')}\n\n`
    : ''

  // Truncate to top 30 spools to manage token use
  const spoolsSample = input.spools.slice(0, 30)
  const userMessage  = `
${input.query ? `Planning Query: ${input.query}\n\n` : ''}Total Spools: ${input.spools.length} (showing top ${spoolsSample.length})

Spools:
${JSON.stringify(spoolsSample, null, 2)}

Milestones:
${JSON.stringify(input.milestones ?? [], null, 2)}

Productivity:
${JSON.stringify(input.productivity ?? {}, null, 2)}

${contextBlock}Generate the fabrication sequence plan. Return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.15,
    max_tokens:      1200,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<FabricationPlanningOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { summary: raw } }

  return {
    data: {
      summary:              parsed.summary              ?? 'Unable to generate fabrication plan.',
      recommended_sequence: parsed.recommended_sequence ?? [],
      critical_path:        parsed.critical_path        ?? [],
      risks:                parsed.risks                ?? [],
      recommendations:      parsed.recommendations      ?? [],
      knowledge_refs: matchedChunks.map(c => ({
        title:      c.title,
        similarity: c.similarity,
      })),
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const fabricationPlanningAdapter: CapabilityAdapter<FabricationPlanningInput, FabricationPlanningOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
