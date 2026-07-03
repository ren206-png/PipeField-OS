import { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register'],
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
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  }
}
