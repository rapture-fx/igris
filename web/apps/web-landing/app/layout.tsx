import './globals.css'
import { Providers } from '../src/components/providers/Providers'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata = {
  metadataBase: new URL('https://igris.inertial'),
  title: 'Igris Inertial — The Routing Engine and Control Plane for AI Inference',
  description: 'Igris Inertial routes AI inference across providers for cost, latency, and reliability optimization using your own API keys.',
  openGraph: {
    title: 'Igris Inertial',
    description: 'Unified routing layer for OpenAI, Anthropic, Gemini, Deepseek, and more.',
    url: 'https://igris.inertial',
    siteName: 'Igris Inertial',
    images: [{ url: '/logo.svg', width: 1200, height: 630, alt: 'Igris Inertial diagram' }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Igris Inertial',
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
    <html lang="en" style={{ backgroundColor: '#f6f6f4' }}>
      <body style={{ backgroundColor: '#f6f6f4' }} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
