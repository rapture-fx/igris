import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation - Schlep-engine',
  description: 'Complete documentation for Schlep-engine - AI-powered data preparation platform',
  keywords: ['API', 'documentation', 'data preparation', 'AI', 'machine learning', 'data processing'],
}

export default function UnifiedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}