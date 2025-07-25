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
        <div className="min-h-screen flex flex-col">
          <div className="sticky top-0 z-50">
            <Header />
          </div>
          <div className="flex flex-1 h-screen">
            <div className="sticky top-[4.5rem] h-[calc(100vh-4.5rem)]">
              <Sidebar />
            </div>
            <main className="flex-1 overflow-y-auto bg-white">
              <div className="w-full pt-12 pb-6 px-6 max-w-4xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}