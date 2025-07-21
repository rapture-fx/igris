import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Schlep Engine API Documentation',
  description: 'Comprehensive API documentation for Schlep Engine - AI-powered data preparation platform',
  keywords: ['API', 'documentation', 'data preparation', 'AI', 'machine learning', 'data processing'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="h-screen bg-white">
          <Header />
          <div className="flex" style={{height: 'calc(100vh - 64px)'}}>
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto py-2 px-4">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}