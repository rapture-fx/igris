import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Schlep-engine API Documentation',
  description: 'Comprehensive API documentation for Schlep-engine - AI-powered data preparation platform',
  keywords: ['API', 'documentation', 'data preparation', 'AI', 'machine learning', 'data processing'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50/30">
        <div className="min-h-screen">
          <div className="container mx-auto px-4 max-w-7xl">
            <Header />
          </div>
          <div className="flex container mx-auto px-4 max-w-7xl">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto py-4 px-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}