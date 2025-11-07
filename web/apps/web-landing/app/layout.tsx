import './globals.css'

export const metadata = {
  metadataBase: new URL('https://schlep.engine'),
  title: 'Schlep-engine — The Routing Engine and Control Plane for AI Inference',
  description: 'Schlep-engine routes AI inference across providers for cost, latency, and reliability optimization using your own API keys.',
  openGraph: {
    title: 'Schlep-engine',
    description: 'Unified routing layer for OpenAI, Anthropic, Gemini, Deepseek, and more.',
    url: 'https://schlep.engine',
    siteName: 'Schlep-engine',
    images: [{ url: '/logo.svg', width: 1200, height: 630, alt: 'Schlep-engine diagram' }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Schlep-engine',
    description: 'The routing engine for AI inference.',
    images: ['/logo.svg']
  },
  icons: { icon: '/logo.svg' }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
