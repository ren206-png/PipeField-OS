import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getResend } from '@/lib/email'

const schema = z.object({
  name:    z.string().min(1).max(100),
  email:   z.string().email().max(200),
  message: z.string().min(10).max(5000),
})

export async function POST(req: NextRequest) {
  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const { name, email, message } = parsed.data
  const TO   = process.env.CONTACT_EMAIL ?? process.env.EMAIL_FROM ?? 'rencoenterprise25@gmail.com'
  const FROM = process.env.EMAIL_FROM    ?? 'PipeField OS <onboarding@resend.dev>'

  const resend = getResend()
  const { error } = await resend.emails.send({
    from:     FROM,
    to:       TO,
    replyTo:  email,
    subject:  `New contact from ${name} — PipeField OS`,
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-wrap">${message}</p>
    `,
  })

  if (error) {
    console.error('[contact] resend error', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
