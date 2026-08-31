// POST /api/field/voice-transcribe
//
// Accepts: multipart/form-data with field 'audio' (webm or m4a blob)
// Returns: { raw_transcript: string; suggestion: { joint_id?: string; event_type: string; note: string } }
//
// CRITICAL: The AI NEVER writes to personal_work_log. This route returns a suggestion only.
// The INSERT to personal_work_log happens ONLY when the user taps Confirm in VoiceNoteFlow.tsx.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { FLAGS } from '@/intelligence/flags'

// ── Suggestion schema (Zod-validated on every boundary) ───────
const SuggestionSchema = z.object({
  joint_id:   z.string().nullable(),
  event_type: z.enum(['welded', 'fit_up', 'note']),
  note:       z.string().max(200),
})

type Suggestion = z.infer<typeof SuggestionSchema>

// ── Graceful degradation fallback ─────────────────────────────
function fallbackSuggestion(rawText: string): Suggestion {
  return {
    joint_id:   null,
    event_type: 'note',
    note:       rawText.slice(0, 200),
  }
}

// ── POST ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!FLAGS.PFOS_FIELD_MODE || !FLAGS.PFOS_FIELD_VOICE_NOTES) {
    return NextResponse.json({ error: 'Voice notes are not enabled' }, { status: 403 })
  }

  const { caller, error } = await requireAuth(req)
  if (error) return error

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const audioField = formData.get('audio')
  if (!audioField || !(audioField instanceof Blob)) {
    return NextResponse.json({ error: 'Missing or invalid audio field' }, { status: 400 })
  }

  // Validate caller has an org (belt-and-suspenders — not strictly needed for this route
  // since we are not writing to the DB, but required by org-scoped operations)
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization associated with this account' }, { status: 400 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // ── Step 1: Whisper transcription ─────────────────────────
  let rawTranscript: string
  try {
    // Convert Blob to File for OpenAI SDK
    const audioBytes = await audioField.arrayBuffer()
    const audioFile = new File([audioBytes], 'audio.webm', { type: audioField.type || 'audio/webm' })

    const transcription = await openai.audio.transcriptions.create({
      file:     audioFile,
      model:    'whisper-1',
      language: 'en',
    })
    rawTranscript = transcription.text
  } catch (err) {
    console.error('[voice-transcribe] Whisper error', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
  }

  // ── Step 2: Structured extraction ─────────────────────────
  // Degrade gracefully — never throw on extraction failure.
  let suggestion: Suggestion
  try {
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are helping a pipefitter log their work. Extract from the transcript:
- joint_id: a joint or weld number if mentioned (e.g. "W-0042"), or null
- event_type: "welded", "fit_up", or "note" — default "note" if unclear
- note: a clean summary of what was said, max 200 chars
Return JSON only: { "joint_id": string|null, "event_type": string, "note": string }`,
        },
        {
          role: 'user',
          content: rawTranscript,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = extraction.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw)

    const validated = SuggestionSchema.safeParse(parsed)
    if (validated.success) {
      suggestion = validated.data
    } else {
      // Validation failed — degrade gracefully, never throw
      console.warn('[voice-transcribe] Suggestion schema validation failed', validated.error.message)
      suggestion = fallbackSuggestion(rawTranscript)
    }
  } catch (err) {
    // Extraction or JSON parse failed — degrade gracefully
    console.warn('[voice-transcribe] Extraction error, using fallback', err)
    suggestion = fallbackSuggestion(rawTranscript)
  }

  // The AI never writes to personal_work_log. We return suggestion only.
  // The INSERT happens only when the user explicitly taps Confirm in VoiceNoteFlow.tsx.
  return NextResponse.json({
    raw_transcript: rawTranscript,
    suggestion,
  })
}
