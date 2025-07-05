import type { Metadata } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-dm-sans' })

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
      <body className={`${inter.variable} ${dmSans.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
} 