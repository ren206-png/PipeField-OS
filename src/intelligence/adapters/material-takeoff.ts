// ============================================================
// Intelligence Engine — Material Takeoff Adapter
//
// Generates structured material takeoff lists from spool items,
// aggregating by material type, size, and schedule. Cross-
// references uploaded spec documents for material class details.
//
// Tiers: starter, professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface SpoolItemInput {
  id?:          string
  item_type?:   string
  description?: string
  quantity?:    number
  length_in?:   number
  heat_number?: string
  is_cut?:      boolean
  is_fitted?:   boolean
}

export interface SpoolInput {
  id?:            string
  spool_number?:  string
  pipe_size?:     string
  pipe_schedule?: string
  material?:      string
  service?:       string
  total_length_in?: number
  total_welds?:   number
  items?:         SpoolItemInput[]
}

export interface MaterialTakeoffInput {
  scope:       'spool' | 'line' | 'project'
  spools:      SpoolInput[]
  project_id?: string
  query?:      string   // optional specific question about the takeoff
}

export interface MaterialLineItem {
  item_type:    string
  description:  string
  size?:        string
  schedule?:    string
  material?:    string
  quantity:     number
  unit:         string
  length_ft?:   number     // pipe lengths converted to feet
  notes?:       string
}

export interface MaterialTakeoffOutput {
  summary:          string
  line_items:       MaterialLineItem[]
  pipe_summary:     PipeSummary[]
  fitting_count:    number
  weld_count:       number
  notes:            string[]
  knowledge_refs:   MaterialKnowledgeRef[]
}

export interface PipeSummary {
  size:       string
  schedule:   string
  material:   string
  length_ft:  number
}

export interface MaterialKnowledgeRef {
  title:      string
  similarity: number
}

interface MatchedChunk {
  chunk_id:      string
  source_id:     string
  content:       string
  title:         string
  document_type: string
  similarity:    number
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are PipeField Material Intelligence, a specialist in pipeline material takeoffs.

Given spool data (pipe sizes, schedules, materials, and spool items), generate a structured material takeoff:

1. Aggregate pipe by nominal size + schedule + material, converting length_in to feet (÷12)
2. List fittings grouped by type and size (elbows, tees, reducers, flanges, caps, valves, etc.)
3. Count total butt welds, socket welds, and flanged connections
4. Note any special materials, heat numbers, or certifications required
5. Flag any missing information that would affect procurement

Return JSON:
{
  summary: string,
  line_items: [{item_type, description, size, schedule, material, quantity, unit, length_ft?, notes?}],
  pipe_summary: [{size, schedule, material, length_ft}],
  fitting_count: number,
  weld_count: number,
  notes: [string]
}

Respond ONLY with valid JSON — no markdown fences, no extra text.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'material-takeoff',
  status:        'ACTIVE',
  requiredTiers: ['starter', 'professional', 'enterprise'],
  dailyTokenBudget: {
    free_trial:   0,
    field_pro:    5_000,
    starter:      25_000,
    professional: 100_000,
    enterprise:   null,
  },
}

// ── Adapter ───────────────────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: MaterialTakeoffInput,
): Promise<AdapterResult<MaterialTakeoffOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Search for pipe class / material spec documents
  const searchQuery = input.query ?? [
    'pipe material specification',
    input.spools[0]?.material,
    input.spools[0]?.pipe_size,
  ].filter(Boolean).join(' ')

  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchQuery,
  })

  const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   embResp.data[0].embedding,
    org_id:            ctx.organizationId,
    match_count:       4,
    filter_project_id: input.project_id ?? null,
  })

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock  = matchedChunks.length > 0
    ? `Relevant Spec Documents:\n${matchedChunks.map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`).join('\n---\n')}\n\n`
    : ''

  // Truncate spool data to stay within token limits for large projects
  const spoolsJson = JSON.stringify(input.spools.slice(0, 50), null, 2)

  const userMessage = `
Scope: ${input.scope}
Total Spools Provided: ${input.spools.length}
${input.query ? `Specific Question: ${input.query}\n` : ''}
${contextBlock}
Spool Data:
${spoolsJson}
${input.spools.length > 50 ? `\n[Note: ${input.spools.length - 50} additional spools truncated for this request]` : ''}

Generate the material takeoff. Return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.1,
    max_tokens:      1500,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<MaterialTakeoffOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { summary: raw } }

  return {
    data: {
      summary:       parsed.summary       ?? 'Unable to generate takeoff.',
      line_items:    parsed.line_items     ?? [],
      pipe_summary:  parsed.pipe_summary   ?? [],
      fitting_count: parsed.fitting_count  ?? 0,
      weld_count:    parsed.weld_count     ?? 0,
      notes:         parsed.notes          ?? [],
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

export const materialTakeoffAdapter: CapabilityAdapter<MaterialTakeoffInput, MaterialTakeoffOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
