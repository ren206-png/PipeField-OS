// ============================================================
// Intelligence Engine — Drawing Analysis Adapter
//
// Vision-based analysis of engineering drawings (isometrics,
// P&IDs, GAs). Uses GPT-4o for vision capability.
// Drawings must be accessible via a public or signed URL.
//
// Tiers: professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export type DrawingType = 'isometric' | 'pnid' | 'general_arrangement' | 'detail' | 'unknown'

export interface DrawingAnalysisInput {
  drawing_url:   string       // Must be publicly accessible or a signed URL
  drawing_type:  DrawingType
  query?:        string       // Specific question about the drawing
  project_id?:   string
  drawing_number?: string
  revision?:     string
}

export interface DrawingAnalysisOutput {
  analysis:        string
  components:      DrawingComponent[]
  dimensions:      string[]
  notes:           string[]
  concerns:        string[]
  knowledge_refs:  DrawingKnowledgeRef[]
  disclaimer:      string
}

export interface DrawingComponent {
  type:        string      // pipe, valve, flange, instrument, nozzle, etc.
  description: string
  tag?:        string      // tag number if visible
  size?:       string
}

export interface DrawingKnowledgeRef {
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

// ── System prompts by drawing type ───────────────────────────
const SYSTEM_PROMPTS: Record<DrawingType, string> = {
  isometric: `You are PipeField Drawing Intelligence, analysing a pipeline isometric drawing.

Extract and describe:
1. All pipe components visible (pipe sizes, schedules, elbows, tees, reducers, flanges, valves, instruments)
2. Key dimensions (lengths, offsets, elevations where visible)
3. Weld symbols and joint types
4. Drawing notes and revision details
5. Any concerns (unclear dimensions, missing information, potential constructability issues)

Return JSON:
{
  analysis: string,
  components: [{type, description, tag?, size?}],
  dimensions: [string],
  notes: [string],
  concerns: [string]
}`,

  pnid: `You are PipeField Drawing Intelligence, analysing a Piping & Instrumentation Diagram (P&ID).

Extract and describe:
1. Process lines (pipe classes, line numbers, flow direction)
2. Equipment tags and types (vessels, pumps, heat exchangers, columns)
3. Instrumentation and control elements (tags, types)
4. Valves (types, tags, failure modes)
5. Utility connections and tie-in points
6. Any revision clouds or open items

Return JSON:
{
  analysis: string,
  components: [{type, description, tag?, size?}],
  dimensions: [],
  notes: [string],
  concerns: [string]
}`,

  general_arrangement: `You are PipeField Drawing Intelligence, analysing a General Arrangement drawing.

Extract and describe:
1. Major equipment and structure locations
2. Pipe routing and key elevations
3. Access and maintenance areas
4. Dimensions and grid references
5. North point and orientation

Return JSON:
{
  analysis: string,
  components: [{type, description, tag?, size?}],
  dimensions: [string],
  notes: [string],
  concerns: [string]
}`,

  detail: `You are PipeField Drawing Intelligence, analysing a detail / spool drawing.

Extract and describe:
1. Component types and connection details
2. Dimensions and tolerances
3. Material callouts
4. Weld symbols and joint preparation details
5. Surface finish or special requirements

Return JSON:
{
  analysis: string,
  components: [{type, description, tag?, size?}],
  dimensions: [string],
  notes: [string],
  concerns: [string]
}`,

  unknown: `You are PipeField Drawing Intelligence, analysing an engineering drawing.

Identify the drawing type and extract all relevant information: components, dimensions, notes, and any concerns.

Return JSON:
{
  analysis: string,
  components: [{type, description, tag?, size?}],
  dimensions: [string],
  notes: [string],
  concerns: [string]
}`,
}

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'drawing-analysis',
  status:        'ACTIVE',
  requiredTiers: ['professional', 'enterprise'],
  dailyTokenBudget: {
    free_trial:   0,
    field_pro:    0,
    starter:      0,
    professional: 50_000,
    enterprise:   null,
  },
}

// ── Adapter ───────────────────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: DrawingAnalysisInput,
): Promise<AdapterResult<DrawingAnalysisOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Search for related spec/procedure documents as context
  const searchQuery = input.query ?? `${input.drawing_type} drawing analysis pipeline`
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchQuery,
  })

  const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   embResp.data[0].embedding,
    org_id:            ctx.organizationId,
    match_count:       3,
    filter_project_id: input.project_id ?? null,
  })

  const matchedChunks = (chunks ?? []) as MatchedChunk[]

  // Build user message
  const metaParts = [
    input.drawing_number && `Drawing Number: ${input.drawing_number}`,
    input.revision       && `Revision: ${input.revision}`,
    input.query          && `Specific Question: ${input.query}`,
  ].filter(Boolean).join('\n')

  const userText = [
    metaParts,
    matchedChunks.length > 0
      ? `Related Project Documents:\n${matchedChunks.map(c => `- ${c.title}: ${c.content.substring(0, 200)}...`).join('\n')}`
      : '',
    '\nAnalyse this drawing and return valid JSON only.',
  ].filter(Boolean).join('\n\n')

  // Vision call — uses GPT-4o (not mini) for drawing interpretation
  const completion = await openai.chat.completions.create({
    model: MODELS.VISION,
    messages: [
      {
        role:    'system',
        content: SYSTEM_PROMPTS[input.drawing_type] ?? SYSTEM_PROMPTS.unknown,
      },
      {
        role:    'user',
        content: [
          { type: 'text',      text:      userText             },
          { type: 'image_url', image_url: { url: input.drawing_url, detail: 'high' } },
        ],
      },
    ],
    temperature:     0.1,
    max_tokens:      1500,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<DrawingAnalysisOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { analysis: raw } }

  return {
    data: {
      analysis:       parsed.analysis    ?? 'Unable to analyse drawing.',
      components:     parsed.components  ?? [],
      dimensions:     parsed.dimensions  ?? [],
      notes:          parsed.notes       ?? [],
      concerns:       parsed.concerns    ?? [],
      knowledge_refs: matchedChunks.map(c => ({
        title:      c.title,
        similarity: c.similarity,
      })),
      disclaimer: 'AI drawing analysis is a supplemental tool only. All dimensions, specifications, and construction details must be verified against the official stamped/issued drawing revision. Do not use AI analysis as the sole basis for fabrication or construction.',
    },
    tokensUsed,
    latencyMs,
    model: MODELS.VISION,
  }
}

export const drawingAnalysisAdapter: CapabilityAdapter<DrawingAnalysisInput, DrawingAnalysisOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
