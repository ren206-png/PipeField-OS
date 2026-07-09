// ============================================================
// Intelligence Engine — Scheduling Adapter
//
// Analyses project schedule against actual progress, identifies
// slippage, and recommends recovery actions. Works from
// milestone data + productivity snapshots.
//
// Tiers: professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface ScheduleMilestone {
  name?:          string
  planned_date?:  string
  actual_date?:   string | null
  status?:        string
  sort_order?:    number
}

export interface ScheduleSpoolSummary {
  total:             number
  not_started?:      number
  in_fabrication?:   number
  fab_complete?:     number
  installed?:        number
  hydro_tested?:     number
}

export interface ScheduleWeldSummary {
  total:     number
  complete?: number
  pending?:  number
  failed?:   number
}

export interface SchedulingInput {
  project_id:    string
  project_name?: string
  start_date?:   string
  end_date?:     string
  milestones?:   ScheduleMilestone[]
  spools?:       ScheduleSpoolSummary
  welds?:        ScheduleWeldSummary
  productivity?: {
    welds_per_day?:  number
    spools_per_day?: number
  }
  query?:        string
}

export interface SchedulingOutput {
  schedule_health:    'on_track' | 'at_risk' | 'delayed' | 'unknown'
  analysis:           string
  milestone_status:   MilestoneStatus[]
  slippage_risks:     string[]
  recovery_actions:   string[]
  forecast_notes:     string[]
  knowledge_refs:     SchedulingKnowledgeRef[]
}

export interface MilestoneStatus {
  name:      string
  status:    string
  variance?: string
}

export interface SchedulingKnowledgeRef {
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
const SYSTEM_PROMPT = `You are PipeField Schedule Intelligence, a scheduling analyst for pipeline and industrial construction.

Analyse the project data to:
1. Assess overall schedule health: on_track | at_risk | delayed | unknown
2. Evaluate each milestone (planned vs actual dates, % complete implied by progress data)
3. Identify schedule slippage risks
4. Recommend practical recovery actions (work sequences, overtime, crew size adjustments)
5. Provide a forecast narrative based on current productivity

Base your analysis on:
- Milestone dates vs today's date (${new Date().toISOString().split('T')[0]})
- Weld/spool completion percentages vs remaining time
- Any productivity data provided

Return JSON:
{
  schedule_health: "on_track"|"at_risk"|"delayed"|"unknown",
  analysis: string,
  milestone_status: [{name, status, variance?}],
  slippage_risks: [string],
  recovery_actions: [string],
  forecast_notes: [string]
}

Respond ONLY with valid JSON.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'scheduling',
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
  input: SchedulingInput,
): Promise<AdapterResult<SchedulingOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Search for project schedule / programme documents
  const searchQuery = input.query ?? 'project schedule programme milestones recovery'
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
    ? `Project Schedule Documents:\n${matchedChunks.map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`).join('\n---\n')}\n\n`
    : ''

  const userMessage = `
Project: ${input.project_name ?? input.project_id}
Start Date: ${input.start_date ?? 'Not specified'}
End Date: ${input.end_date ?? 'Not specified'}
Today: ${new Date().toISOString().split('T')[0]}
${input.query ? `\nScheduling Query: ${input.query}\n` : ''}
Milestones:
${JSON.stringify(input.milestones ?? [], null, 2)}

Spool Progress: ${JSON.stringify(input.spools ?? {}, null, 2)}
Weld Progress:  ${JSON.stringify(input.welds ?? {}, null, 2)}
Productivity:   ${JSON.stringify(input.productivity ?? {}, null, 2)}

${contextBlock}Analyse the schedule and return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.15,
    max_tokens:      1000,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<SchedulingOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { analysis: raw } }

  return {
    data: {
      schedule_health:  parsed.schedule_health  ?? 'unknown',
      analysis:         parsed.analysis          ?? 'Unable to generate schedule analysis.',
      milestone_status: parsed.milestone_status  ?? [],
      slippage_risks:   parsed.slippage_risks    ?? [],
      recovery_actions: parsed.recovery_actions  ?? [],
      forecast_notes:   parsed.forecast_notes    ?? [],
      knowledge_refs:   matchedChunks.map(c => ({
        title:      c.title,
        similarity: c.similarity,
      })),
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const schedulingAdapter: CapabilityAdapter<SchedulingInput, SchedulingOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
