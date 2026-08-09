// POST /api/ai/iso-blueprint-3d
// Accepts a multipart/form-data upload of an ISO drawing (PNG, JPG, JPEG, PDF)
// and returns a structured 3D spatial breakdown via GPT-4o vision.
//
// NOTE: This route bypasses the Intelligence Engine registry (src/intelligence/registry.ts)
// and calls the OpenAI API directly. It does NOT go through the standard capability gate
// (flag check, tier check, budget accounting). Consider migrating to a registry adapter
// if usage-gating or audit-trail parity with other AI routes is required.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getOpenAIClient } from '@/intelligence/client'
import { logInvocation } from '@/intelligence/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
])

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

const SYSTEM_PROMPT = `You are an expert piping engineer analyzing isometric (ISO) drawings.
Extract a complete 3D spatial breakdown of the piping layout shown.
Return a JSON object with this exact structure:
{
  "summary": "one paragraph description of the overall piping system",
  "pipe_runs": [
    {
      "run_id": "R1",
      "direction": "North-South | East-West | Vertical | NE-SW | NW-SE",
      "elevation": "e.g. +2400mm EL | Ground Level | +3600mm EL",
      "pipe_size": "e.g. 6\" SCH 40 | 4\" SCH 80",
      "material": "e.g. CS A106-B | SS 316L",
      "length_estimate": "e.g. ~4200mm | Unknown",
      "start_point": "e.g. Vessel V-101 nozzle N2 | Tee T-1",
      "end_point": "e.g. Elbow E-3 | Flange F-2",
      "notes": "any relevant notes about this run"
    }
  ],
  "fittings": [
    {
      "tag": "e.g. E-1 | T-1 | R-1",
      "type": "Elbow | Tee | Reducer | Flange | Valve | Cap | Coupling",
      "size": "e.g. 6\" x 4\" | 6\" 90°LR",
      "location": "brief location description",
      "elevation": "e.g. +2400mm EL"
    }
  ],
  "supports": [
    {
      "tag": "e.g. PS-1",
      "type": "e.g. Pipe Shoe | U-Bolt | Spring Hanger | Anchor",
      "location": "brief description"
    }
  ],
  "elevations": {
    "lowest": "e.g. Ground Level (0mm)",
    "highest": "e.g. +4800mm EL",
    "key_elevations": ["list of notable elevation changes"]
  },
  "flow_direction": "overall flow path description",
  "line_number": "extracted line number if visible, else null",
  "concerns": ["any constructability, clash, or code concerns spotted"],
  "confidence": "high | medium | low"
}`

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  // 1. Auth
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    // 2. Parse multipart form
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    // 3. Validate
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PNG, JPG, JPEG, or PDF.' },
        { status: 400 },
      )
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds the 10 MB limit. Please reduce the file size and try again.' },
        { status: 400 },
      )
    }

    // 4. Convert to base64 data URL
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // 5. Call GPT-4o vision
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
            {
              type: 'text',
              text: 'Analyze this isometric drawing and extract the complete 3D spatial breakdown as specified.',
            },
          ],
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const tokensUsed = response.usage?.total_tokens ?? 0
    const latencyMs = Date.now() - startTime

    // 6. Parse
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { summary: raw }
    }

    // 7. Log to ai_invocations
    await logInvocation({
      organization_id: caller.organization_id ?? '',
      user_id:         caller.id,
      capability:      'iso-blueprint-3d',
      model:           'gpt-4o',
      tokens_used:     tokensUsed,
      latency_ms:      latencyMs,
      flag_state:      {},
      status:          'success',
    })

    // 8. Return
    return NextResponse.json({ data: parsed })

  } catch (err) {
    const latencyMs = Date.now() - startTime

    // Log the failure
    await logInvocation({
      organization_id: caller.organization_id ?? '',
      user_id:         caller.id,
      capability:      'iso-blueprint-3d',
      model:           'gpt-4o',
      tokens_used:     0,
      latency_ms:      latencyMs,
      flag_state:      {},
      status:          'error',
      error_message:   err instanceof Error ? err.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ISO Blueprint 3D analysis failed.' },
      { status: 500 },
    )
  }
}
