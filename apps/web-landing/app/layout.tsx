import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '../src/hooks/useTheme'

export const metadata: Metadata = {
  title: 'Schlep Engine - AI-Powered Data Preparation',
  description: 'Transform messy data into ML-ready formats with intelligent pattern recognition and automated workflows. Eliminate 80% of data preparation time.',
  keywords: ['data preparation', 'machine learning', 'AI', 'data cleaning', 'ML pipeline', 'data transformation'],
  authors: [{ name: 'Schlep Engine Team' }],
  creator: 'Schlep Engine',
  publisher: 'Schlep Engine',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://schlepengine.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://schlepengine.com',
    title: 'Schlep Engine - AI-Powered Data Preparation',
    description: 'Transform messy data into ML-ready formats with intelligent pattern recognition and automated workflows.',
    siteName: 'Schlep Engine',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Schlep Engine - AI-Powered Data Preparation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Schlep Engine - AI-Powered Data Preparation',
    description: 'Transform messy data into ML-ready formats with intelligent pattern recognition and automated workflows.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}