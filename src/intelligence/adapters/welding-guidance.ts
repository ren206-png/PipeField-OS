// ============================================================
// Intelligence Engine — Welding Guidance Adapter
//
// Surfaces WPS recommendations and welder certification checks
// for a given weld record. Searches org knowledge base for
// relevant procedure documents and cross-references structured
// wps_records data to recommend the best-fit WPS.
//
// Flag: PFOS_INTELLIGENCE_WELDING_GUIDANCE (must be ON)
// Tiers: starter, professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface WpsRecord {
  id:                    string
  wps_number:            string
  revision?:             string
  process?:              string
  base_metal_p_numbers?: string
  filler_material?:      string
  thickness_min_in?:     number
  thickness_max_in?:     number
  position?:             string
  pwht_required?:        boolean
  notes?:                string
  is_active?:            boolean
}

export interface WelderInfo {
  id?:         string
  stamp?:      string
  name?:       string
  process?:    string[]
  position?:   string[]
  cert_expiry?: string
}

export interface WeldingGuidanceInput {
  weld: {
    size?:             string
    schedule?:         string
    material?:         string
    process?:          string
    weld_type?:        string
    joint_type?:       string
    wall_thickness_in?: number
    position?:         string
    service?:          string
  }
  wps_candidates?: WpsRecord[]
  welder?:         WelderInfo
  project_id?:     string
  query?:          string    // optional freeform override
}

export interface WeldingGuidanceOutput {
  recommendation:      string
  matched_wps:         WpsRecordMatch[]
  cert_warnings:       string[]
  knowledge_sources:   WeldingKnowledgeSource[]
  confidence:          'high' | 'medium' | 'low'
}

export interface WpsRecordMatch {
  wps_number: string
  reason:     string
}

export interface WeldingKnowledgeSource {
  title:        string
  document_type: string
  similarity:   number
}

interface MatchedChunk {
  chunk_id:      string
  source_id:     string
  content:       string
  title:         string
  document_type: string
  file_name:     string
  public_url:    string | null
  similarity:    number
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are PipeField Welding Intelligence, a specialist assistant for pipeline welding engineers and QC teams.

Given a weld record's attributes and available Welding Procedure Specifications (WPS), you:
1. Recommend the most appropriate WPS(es) for the weld based on process, material, thickness, and position
2. Flag any welder certification concerns (expired certs, process/position mismatches)
3. Highlight relevant procedural requirements from knowledge documents
4. Note any pre-heat, PWHT, or special requirements

Rules:
- Only recommend WPS records explicitly provided — never invent procedure numbers
- If no WPS matches the weld parameters, state this clearly
- For safety-critical decisions, remind the user to verify with a CWI or welding engineer
- Cite knowledge documents by title when referenced
- Return a JSON object with keys: recommendation (string), matched_wps (array of {wps_number, reason}), cert_warnings (string array), confidence ("high"|"medium"|"low")

Respond ONLY with valid JSON — no markdown fences, no extra text.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'welding-guidance',
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
  input: WeldingGuidanceInput,
): Promise<AdapterResult<WeldingGuidanceOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // 1. Build the query string for knowledge base search
  const queryParts = [
    input.weld.process && `welding process ${input.weld.process}`,
    input.weld.material && `material ${input.weld.material}`,
    input.weld.weld_type && `${input.weld.weld_type} weld`,
    input.query,
  ].filter(Boolean)
  const searchQuery = queryParts.length > 0
    ? queryParts.join(' ')
    : 'welding procedure specification requirements'

  // 2. Embed and search knowledge base
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchQuery,
  })
  const queryEmbedding = embResp.data[0].embedding

  const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   queryEmbedding,
    org_id:            ctx.organizationId,
    match_count:       6,
    filter_project_id: input.project_id ?? null,
  })

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock = matchedChunks
    .map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`)
    .join('\n\n---\n\n')

  // 3. Build user message with weld context + WPS candidates
  const weldJson     = JSON.stringify(input.weld, null, 2)
  const wpsJson      = JSON.stringify(input.wps_candidates ?? [], null, 2)
  const welderJson   = JSON.stringify(input.welder ?? {}, null, 2)

  const userMessage = `
Weld Parameters:
${weldJson}

Available WPS Records (from this org's database):
${wpsJson}

Welder Information:
${welderJson}

${contextBlock ? `Relevant Knowledge Documents:\n${contextBlock}\n\n` : ''}
Provide welding guidance for this weld. Return valid JSON only.`.trim()

  // 4. GPT-4o-mini completion
  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.1,
    max_tokens:      800,
    response_format: { type: 'json_object' },
  })

  const raw       = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  // 5. Parse response
  let parsed: Partial<WeldingGuidanceOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { recommendation: raw } }

  return {
    data: {
      recommendation:    parsed.recommendation    ?? 'Unable to generate recommendation.',
      matched_wps:       parsed.matched_wps       ?? [],
      cert_warnings:     parsed.cert_warnings     ?? [],
      knowledge_sources: matchedChunks.map(c => ({
        title:         c.title,
        document_type: c.document_type,
        similarity:    c.similarity,
      })),
      confidence: parsed.confidence ?? 'low',
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const weldingGuidanceAdapter: CapabilityAdapter<WeldingGuidanceInput, WeldingGuidanceOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
