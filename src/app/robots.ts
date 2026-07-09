import { MetadataRoute } from 'next'
import { SITE_URL, siteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/blog', '/calculators'],
        disallow: [
          '/dashboard',
          '/projects',
          '/welds',
          '/spools',
          '/documents',
          '/reports',
          '/settings',
          '/admin',
          '/api/',
          '/share/',
        ],
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
    host: SITE_URL,
  }
}
