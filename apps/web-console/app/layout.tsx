import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Schlep-Engine API Console',
  description: 'Interactive API console for testing and exploring Schlep-Engine industry-specific AI solutions',
  keywords: ['API', 'console', 'AI', 'machine learning', 'data processing', 'industry solutions'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-900`}>
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}