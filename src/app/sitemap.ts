import { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  // ── Static marketing & auth pages ────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: siteUrl('/login'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: siteUrl('/register'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: siteUrl('/privacy'),
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: siteUrl('/terms'),
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // ── Blog posts ────────────────────────────────────────────
  const blogPosts: MetadataRoute.Sitemap = [
    {
      url: siteUrl('/blog'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: siteUrl('/blog/pipe-offset-calculator-guide'),
      lastModified: new Date('2026-07-01'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: siteUrl('/blog/b313-weld-inspection-checklist'),
      lastModified: new Date('2026-06-25'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: siteUrl('/blog/pipefitter-tools-2026'),
      lastModified: new Date('2026-06-18'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: siteUrl('/blog/pipe-support-span-calculator'),
      lastModified: new Date('2026-06-10'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  // ── Calculator landing pages (Phase 4) ───────────────────
  // These public SEO pages are added in Phase 4.
  // Slugs mirror the gated calculator tabs so internal links are consistent.
  const calculatorSlugs = [
    'pipe-properties',
    'take-out-cut-length',
    'offset-calculator',
    'pipe-weight-barlows',
    'thermal-expansion',
    'support-span',
  ]
  const calculatorPages: MetadataRoute.Sitemap = calculatorSlugs.map(slug => ({
    url: siteUrl(`/calculators/${slug}`),
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }))

  return [...staticPages, ...blogPosts, ...calculatorPages]
}
