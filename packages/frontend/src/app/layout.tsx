import type { Metadata, Viewport } from 'next'
import { Inter, Figtree } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })
const figtree = Figtree({ 
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pollarbase',
      description: 'Data Intelligence Platform',
  keywords: ['AI', 'Data Intelligence', 'Analytics', 'Data Processing'],
  authors: [{ name: 'Pollarbase Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${figtree.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
} 