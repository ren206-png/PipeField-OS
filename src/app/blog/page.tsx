import Link from 'next/link'
import { Flame } from 'lucide-react'

const posts = [
  {
    slug: 'pipe-offset-calculator-guide',
    title: 'How to Calculate Pipe Offsets: Simple & Rolling Offsets Explained',
    date: '2026-07-01',
    excerpt: 'Learn how to calculate simple and rolling pipe offsets in the field — formulas, examples, and a free built-in calculator.',
    readTime: '5 min read',
    category: 'Field Guide',
  },
  {
    slug: 'b313-weld-inspection-checklist',
    title: 'B31.3 Weld Inspection Checklist: What Every QC Manager Needs to Know',
    date: '2026-06-25',
    excerpt: 'A practical checklist for ASME B31.3 weld inspection — from fit-up through NDE to final acceptance.',
    readTime: '7 min read',
    category: 'QC & Compliance',
  },
  {
    slug: 'pipefitter-tools-2026',
    title: 'The 6 Essential Calculations Every Pipefitter Needs on the Job',
    date: '2026-06-18',
    excerpt: 'From Barlow\'s formula to thermal expansion — the math pipefitters use every day and how to do it faster.',
    readTime: '6 min read',
    category: 'Field Guide',
  },
  {
    slug: 'pipe-support-span-calculator',
    title: 'Pipe Support Span Calculator: How to Determine Maximum Spacing',
    date: '2026-06-10',
    excerpt: 'Understanding maximum support spacing per ASME/MSS guidelines — with a built-in calculator for any pipe size.',
    readTime: '4 min read',
    category: 'Field Guide',
  },
]

export const metadata = {
  title: 'Blog — Pipeline QC & Pipefitter Field Guides',
  description: 'Practical guides for pipeline construction teams and pipefitters — weld inspection, field calculations, QC compliance, and more.',
}

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-surface-900 text-surface-50 font-sans">
      {/* Nav */}
      <nav className="border-b border-surface-800 bg-surface-900/90 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-brand-500" />
          <span className="font-bold text-surface-50">PipeField OS</span>
        </Link>
        <Link href="/register" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
          Get Started Free
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-surface-50 mb-4">Pipeline & Pipefitter Guides</h1>
          <p className="text-surface-400 text-lg">Practical articles for QC managers, inspectors, and field pipefitters.</p>
        </div>

        <div className="space-y-6">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="block group">
              <article className="rounded-2xl border border-surface-700 bg-surface-800 p-6 hover:border-brand-500/40 hover:shadow-glow transition-all duration-200">
                <div className="flex items-center gap-3 mb-3">
                  <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
                    {post.category}
                  </span>
                  <span className="text-xs text-surface-500">{post.date} · {post.readTime}</span>
                </div>
                <h2 className="text-xl font-bold text-surface-50 mb-2 group-hover:text-brand-400 transition-colors">
                  {post.title}
                </h2>
                <p className="text-surface-400 text-sm leading-relaxed">{post.excerpt}</p>
              </article>
            </Link>
          ))}
        </div>
      </div>

      <footer className="border-t border-surface-800 py-8 text-center text-sm text-surface-600">
        © 2026 PipeField OS ·{' '}
        <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
      </footer>
    </div>
  )
}
