import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Schlep-engine | The Stripe for Data',
  description: 'The comprehensive API platform that handles your data schlep. Transform messy data into ML-ready datasets with 95%+ accuracy using advanced AI algorithms.',
  keywords: ['data processing', 'data cleaning', 'csv handler', 'data preparation', 'etl', 'data pipeline'],
  authors: [{ name: 'Pollarbase Team' }],
  openGraph: {
    title: 'Pollarbase - We Handle the Schlep',
    description: 'The only data platform that actually understands your pain. Throw us your worst CSV files, we\'ll make them work.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pollarbase - The Data Schlep Handler',
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
      <body className={inter.className}>{children}</body>
    </html>
  )
} 