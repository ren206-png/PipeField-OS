import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Flame, ArrowLeft } from 'lucide-react'

interface Props { params: Promise<{ slug: string }> }

// Import post content dynamically
async function getPost(slug: string) {
  try {
    const post = await import(`@/content/blog/${slug}.mdx`)
    return post
  } catch {
    return null
  }
}

const postMeta: Record<string, { title: string; date: string; readTime: string; category: string; description: string }> = {
  'pipe-offset-calculator-guide': {
    title: 'How to Calculate Pipe Offsets: Simple & Rolling Offsets Explained',
    date: '2026-07-01',
    readTime: '5 min read',
    category: 'Field Guide',
    description: 'Learn how to calculate simple and rolling pipe offsets in the field — formulas, examples, and a free built-in calculator.',
  },
  'b313-weld-inspection-checklist': {
    title: 'B31.3 Weld Inspection Checklist: What Every QC Manager Needs to Know',
    date: '2026-06-25',
    readTime: '7 min read',
    category: 'QC & Compliance',
    description: 'A practical checklist for ASME B31.3 weld inspection — from fit-up through NDE to final acceptance.',
  },
  'pipefitter-tools-2026': {
    title: 'The 6 Essential Calculations Every Pipefitter Needs on the Job',
    date: '2026-06-18',
    readTime: '6 min read',
    category: 'Field Guide',
    description: 'From Barlow\'s formula to thermal expansion — the math pipefitters use every day and how to do it faster.',
  },
  'pipe-support-span-calculator': {
    title: 'Pipe Support Span Calculator: How to Determine Maximum Spacing',
    date: '2026-06-10',
    readTime: '4 min read',
    category: 'Field Guide',
    description: 'Understanding maximum support spacing per ASME/MSS guidelines — with a built-in calculator for any pipe size.',
  },
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const meta = postMeta[slug]
  if (!meta) return {}

  const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'
  const canonicalUrl = `${SITE_URL}/blog/${slug}`
  // Per-post OG image — passes the post title and category as subtitle so the
  // dynamic /og edge function renders a unique card for every article.
  const ogImageUrl = `${SITE_URL}/og?title=${encodeURIComponent(meta.title)}&subtitle=${encodeURIComponent(meta.category + ' · PipeField OS')}`

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonicalUrl,
      type: 'article',
      publishedTime: meta.date,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: meta.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [ogImageUrl],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  const meta = postMeta[slug]
  if (!post || !meta) notFound()
  const Content = post.default

  return (
    <div className="min-h-screen bg-surface-900 text-surface-50 font-sans">
      <nav className="border-b border-surface-800 bg-surface-900/90 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-brand-500" />
          <span className="font-bold text-surface-50">PipeField OS</span>
        </Link>
        <Link href="/register" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
          Get Started Free
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          All Articles
        </Link>

        <div className="mb-3 flex items-center gap-3">
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
            {meta.category}
          </span>
          <span className="text-xs text-surface-500">{meta.date} · {meta.readTime}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-50 mb-8 leading-tight">{meta.title}</h1>

        <div className="prose prose-invert prose-brand max-w-none
          prose-headings:text-surface-50 prose-headings:font-bold
          prose-p:text-surface-300 prose-p:leading-relaxed
          prose-strong:text-surface-100
          prose-code:text-brand-400 prose-code:bg-surface-800 prose-code:px-1 prose-code:rounded
          prose-pre:bg-surface-800 prose-pre:border prose-pre:border-surface-700
          prose-ul:text-surface-300 prose-li:text-surface-300
          prose-a:text-brand-400 hover:prose-a:text-brand-300
          prose-blockquote:border-brand-500 prose-blockquote:text-surface-400">
          <Content />
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-8 text-center">
          <h3 className="text-xl font-bold text-surface-50 mb-2">Try the free pipefitter calculators</h3>
          <p className="text-surface-400 mb-6 text-sm">Offset, cut length, pipe weight, thermal expansion — all in one place. No installation.</p>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
            Open Calculators Free →
          </Link>
        </div>
      </div>
    </div>
  )
}
