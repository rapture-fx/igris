import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Schlep-engine | The Stripe for Data',
  description: 'The comprehensive API platform that handles your data schlep. Transform messy data into ML-ready datasets with 95%+ accuracy using advanced AI algorithms.',
  keywords: ['data processing', 'data cleaning', 'csv handler', 'data preparation', 'etl', 'data pipeline'],
  authors: [{ name: 'Schlep-engine Team' }],
  openGraph: {
    title: 'Schlep-engine - We Handle the Schlep',
    description: 'The only data platform that actually understands your pain. Throw us your worst CSV files, we\'ll make them work.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Schlep-engine - The Data Schlep Handler',
    description: 'Stop wasting time on data prep. We fix your broken data so you don\'t have to.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
} 