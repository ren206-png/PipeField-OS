// generateStaticParams is required here (server context) because the page files
// are 'use client' components and cannot export it themselves.
// Returning [] means no pages are pre-generated; they render client-side at runtime.
export function generateStaticParams() {
  return []
}

export default function DynamicSegmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
