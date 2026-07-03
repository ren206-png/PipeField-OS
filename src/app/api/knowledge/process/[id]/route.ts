// ============================================================
// POST /api/knowledge/process/[id]
// Background text extraction + embedding pipeline.
// Called fire-and-forget from the upload route.
// Can be authenticated via user session OR internal secret header.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? 'internal'
const CHUNK_SIZE      = 2000   // ~500 tokens in chars
const CHUNK_OVERLAP   = 200    // sliding window overlap

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Text extraction ───────────────────────────────────────────

async function extractText(buffer: Buffer, mimeType: string): Promise<string | null> {
  // PDF
  if (mimeType === 'application/pdf') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import('pdf-parse')) as any
    const data = await (pdfParse.default ?? pdfParse)(buffer)
    return data.text
  }

  // DOCX
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword') {
    const mammoth = await import('mammoth')
    const result  = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Plain text / CSV
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8')
  }

  // Images, CAD, etc. — skip text extraction
  return null
}

// ── Chunking ──────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 0) chunks.push(chunk)
    if (end >= text.length) break
    start = end - CHUNK_OVERLAP
  }

  return chunks
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params

  // Auth: accept internal secret header OR valid user session
  const authHeader = req.headers.get('authorization') ?? ''
  const isInternal = authHeader === `Bearer ${INTERNAL_SECRET}`

  if (!isInternal) {
    // Fallback: could validate user session here, but for simplicity
    // we only allow internal calls from the upload route.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Mark as processing
  await admin
    .from('knowledge_sources')
    .update({ processing_status: 'processing' })
    .eq('id', sourceId)

  try {
    // Fetch the source record
    const { data: source, error: fetchError } = await admin
      .from('knowledge_sources')
      .select('id, organization_id, storage_path, file_type, title')
      .eq('id', sourceId)
      .single()

    if (fetchError || !source) {
      throw new Error(fetchError?.message ?? 'Source not found')
    }

    // Download file from storage
    const { data: fileData, error: dlError } = await admin.storage
      .from('knowledge-docs')
      .download(source.storage_path)

    if (dlError || !fileData) {
      throw new Error(dlError?.message ?? 'File download failed')
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    // Extract text
    const fullText = await extractText(buffer, source.file_type)

    if (!fullText || fullText.trim().length === 0) {
      // No extractable text (image, CAD file, etc.) — mark ready with 0 chunks
      await admin
        .from('knowledge_sources')
        .update({
          processing_status: 'ready',
          chunk_count:       0,
          extracted_text:    null,
        })
        .eq('id', sourceId)

      return NextResponse.json({ ok: true, chunks: 0 })
    }

    // Chunk the text
    const chunks = chunkText(fullText)

    // Generate embeddings in batches of 100
    const BATCH_SIZE = 100
    const allEmbeddings: number[][] = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const resp  = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      })
      allEmbeddings.push(...resp.data.map(d => d.embedding))
    }

    // Delete any existing chunks for this source (re-processing case)
    await admin
      .from('knowledge_chunks')
      .delete()
      .eq('source_id', sourceId)

    // Insert chunks with embeddings
    const rows = chunks.map((content, i) => ({
      source_id:       sourceId,
      organization_id: source.organization_id,
      chunk_index:     i,
      content,
      token_count:     Math.round(content.length / 4), // rough estimate
      embedding:       JSON.stringify(allEmbeddings[i]),
    }))

    const { error: insertError } = await admin
      .from('knowledge_chunks')
      .insert(rows)

    if (insertError) throw new Error(insertError.message)

    // Update source record
    await admin
      .from('knowledge_sources')
      .update({
        processing_status: 'ready',
        chunk_count:       chunks.length,
        extracted_text:    fullText.slice(0, 50000), // cap stored text at 50k chars
      })
      .eq('id', sourceId)

    return NextResponse.json({ ok: true, chunks: chunks.length })

  } catch (err) {
    console.error('[knowledge/process]', err)

    await admin
      .from('knowledge_sources')
      .update({ processing_status: 'failed' })
      .eq('id', sourceId)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 },
    )
  }
}
